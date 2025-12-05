/**
 * Fallback Similarity Search - TF-IDF + Cosine Similarity for Forge Entities
 * 
 * Use this when Supabase is not available or for small datasets (<1000 items).
 * Stores embeddings in Forge Entities and computes similarity in-memory.
 * 
 * Features:
 * - TF-IDF vectorization (no external dependencies)
 * - Cosine similarity calculation
 * - Persistence in Forge Entities
 * - Efficient search for small datasets
 * 
 * @module fallback_similarity
 */

import { storage } from '@forge/api';

/**
 * TF-IDF Vectorizer - Converts text to numerical vectors
 */
class TFIDFVectorizer {
  constructor() {
    this.vocabulary = new Map(); // word -> index
    this.idf = new Map(); // word -> IDF score
    this.documentCount = 0;
  }

  /**
   * Tokenize text into words
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2); // Remove short words
  }

  /**
   * Calculate term frequency for a document
   */
  calculateTF(tokens) {
    const tf = new Map();
    const totalTerms = tokens.length;

    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    // Normalize by document length
    for (const [token, count] of tf.entries()) {
      tf.set(token, count / totalTerms);
    }

    return tf;
  }

  /**
   * Build vocabulary and IDF from documents
   */
  fit(documents) {
    this.documentCount = documents.length;
    const documentFrequency = new Map();

    // Count document frequency for each term
    for (const doc of documents) {
      const tokens = this.tokenize(doc);
      const uniqueTokens = new Set(tokens);

      for (const token of uniqueTokens) {
        documentFrequency.set(
          token,
          (documentFrequency.get(token) || 0) + 1
        );
      }
    }

    // Build vocabulary and calculate IDF
    let vocabIndex = 0;
    for (const [token, df] of documentFrequency.entries()) {
      this.vocabulary.set(token, vocabIndex++);
      // IDF = log(N / df) where N = total documents
      this.idf.set(token, Math.log(this.documentCount / df));
    }
  }

  /**
   * Transform text to TF-IDF vector
   */
  transform(text) {
    const tokens = this.tokenize(text);
    const tf = this.calculateTF(tokens);
    const vector = new Array(this.vocabulary.size).fill(0);

    for (const [token, tfScore] of tf.entries()) {
      if (this.vocabulary.has(token)) {
        const index = this.vocabulary.get(token);
        const idfScore = this.idf.get(token) || 0;
        vector[index] = tfScore * idfScore;
      }
    }

    return vector;
  }

  /**
   * Fit and transform in one step
   */
  fitTransform(documents) {
    this.fit(documents);
    return documents.map(doc => this.transform(doc));
  }

  /**
   * Serialize vectorizer for storage
   */
  toJSON() {
    return {
      vocabulary: Array.from(this.vocabulary.entries()),
      idf: Array.from(this.idf.entries()),
      documentCount: this.documentCount
    };
  }

  /**
   * Deserialize vectorizer from storage
   */
  static fromJSON(data) {
    const vectorizer = new TFIDFVectorizer();
    vectorizer.vocabulary = new Map(data.vocabulary);
    vectorizer.idf = new Map(data.idf);
    vectorizer.documentCount = data.documentCount;
    return vectorizer;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Fallback Similarity Searcher using Forge Entities
 */
class FallbackSimilaritySearcher {
  constructor() {
    this.vectorizer = null;
    this.storagePrefix = 'similarity-fallback';
  }

  /**
   * Get storage key for entity type
   */
  _getKey(suffix) {
    return `${this.storagePrefix}-${suffix}`;
  }

  /**
   * Extract text from PR payload (matches Python version)
   */
  extractPRText(prPayload) {
    const parts = [];

    if (prPayload.title) {
      parts.push(`Title: ${prPayload.title}`);
    }

    if (prPayload.description) {
      parts.push(`Description: ${prPayload.description}`);
    }

    if (prPayload.files) {
      const filePaths = prPayload.files.map(f => f.path || '').slice(0, 20);
      parts.push(`Changed files: ${filePaths.join(', ')}`);
    }

    if (prPayload.diff) {
      let diff = prPayload.diff;
      if (diff.length > 50000) {
        diff = diff.substring(0, 50000) + '\n... (truncated)';
      }
      parts.push(`Diff:\n${diff}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Extract text from Jira issue (matches Python version)
   */
  extractJiraText(issueData) {
    const parts = [];

    if (issueData.key) {
      parts.push(`Issue: ${issueData.key}`);
    }

    if (issueData.fields) {
      const fields = issueData.fields;

      if (fields.summary) {
        parts.push(`Summary: ${fields.summary}`);
      }

      if (fields.description) {
        parts.push(`Description: ${fields.description}`);
      }

      if (fields.labels) {
        parts.push(`Labels: ${fields.labels.join(', ')}`);
      }

      if (fields.comment && fields.comment.comments) {
        const comments = fields.comment.comments.slice(-5);
        const commentTexts = comments.map(c => c.body || '');
        parts.push(`Recent comments:\n${commentTexts.join('\n')}`);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Index a new item (PR or Jira issue)
   */
  async indexItem(type, sourceId, payload, metadata = {}) {
    // Extract text
    let content;
    if (type === 'pr') {
      content = this.extractPRText(payload);
    } else if (type === 'jira_issue') {
      content = this.extractJiraText(payload);
    } else {
      content = JSON.stringify(payload);
    }

    // Truncate content for storage
    const contentTruncated = content.substring(0, 5000);

    // Load existing items
    const items = await this._loadItems();

    // Add new item
    const item = {
      id: sourceId,
      type,
      sourceId,
      content: contentTruncated,
      metadata: {
        ...metadata,
        indexed_at: new Date().toISOString()
      }
    };

    items.push(item);

    // Save items
    await storage.set(this._getKey('items'), items);

    // Rebuild vectorizer with new item
    await this._rebuildVectorizer();

    console.log(`✓ Indexed ${type} ${sourceId} (fallback mode)`);
    return item;
  }

  /**
   * Load all indexed items
   */
  async _loadItems() {
    const items = await storage.get(this._getKey('items'));
    return items || [];
  }

  /**
   * Rebuild TF-IDF vectorizer from all items
   */
  async _rebuildVectorizer() {
    const items = await this._loadItems();

    if (items.length === 0) {
      this.vectorizer = new TFIDFVectorizer();
      return;
    }

    // Extract all content
    const documents = items.map(item => item.content);

    // Build vectorizer
    this.vectorizer = new TFIDFVectorizer();
    this.vectorizer.fit(documents);

    // Compute and cache vectors
    const vectors = documents.map(doc => this.vectorizer.transform(doc));

    // Save vectorizer and vectors
    await storage.set(this._getKey('vectorizer'), this.vectorizer.toJSON());
    await storage.set(this._getKey('vectors'), vectors);
  }

  /**
   * Load vectorizer from storage
   */
  async _loadVectorizer() {
    if (this.vectorizer) {
      return; // Already loaded
    }

    const data = await storage.get(this._getKey('vectorizer'));
    if (data) {
      this.vectorizer = TFIDFVectorizer.fromJSON(data);
    } else {
      this.vectorizer = new TFIDFVectorizer();
    }
  }

  /**
   * Search for similar items
   */
  async search(queryText, options = {}) {
    const {
      type = null, // Filter by type ('pr', 'jira_issue', etc.)
      threshold = 0.3, // Lower threshold for TF-IDF (less precise than embeddings)
      topK = 5
    } = options;

    // Load vectorizer and items
    await this._loadVectorizer();
    const items = await this._loadItems();
    const vectors = await storage.get(this._getKey('vectors')) || [];

    if (items.length === 0) {
      return [];
    }

    // Transform query
    const queryVector = this.vectorizer.transform(queryText);

    // Compute similarities
    const results = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Apply type filter
      if (type && item.type !== type) {
        continue;
      }

      const similarity = cosineSimilarity(queryVector, vectors[i]);

      if (similarity >= threshold) {
        results.push({
          ...item,
          similarity
        });
      }
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK);
  }

  /**
   * Search for similar PRs
   */
  async searchSimilarPRs(prPayload, options = {}) {
    const content = this.extractPRText(prPayload);
    return this.search(content, { ...options, type: 'pr' });
  }

  /**
   * Search for similar Jira issues
   */
  async searchSimilarIssues(issueData, options = {}) {
    const content = this.extractJiraText(issueData);
    return this.search(content, { ...options, type: 'jira_issue' });
  }

  /**
   * Find related incidents for a PR
   */
  async findRelatedIncidents(prPayload, options = {}) {
    const { topK = 5, threshold = 0.3, daysBack = 90 } = options;

    const content = this.extractPRText(prPayload);
    const results = await this.search(content, {
      type: 'jira_issue',
      threshold,
      topK: topK * 2 // Get more candidates for filtering
    });

    // Filter by date
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    const filtered = results.filter(item => {
      const indexedAt = new Date(item.metadata.indexed_at);
      return indexedAt >= cutoff;
    });

    return filtered.slice(0, topK);
  }

  /**
   * Get statistics about indexed items
   */
  async getStats() {
    const items = await this._loadItems();

    const typeCounts = {};
    for (const item of items) {
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    }

    return {
      total: items.length,
      byType: typeCounts
    };
  }

  /**
   * Clear all indexed items (useful for testing)
   */
  async clear() {
    await storage.delete(this._getKey('items'));
    await storage.delete(this._getKey('vectorizer'));
    await storage.delete(this._getKey('vectors'));
    this.vectorizer = null;
    console.log('✓ Cleared fallback similarity storage');
  }
}

// Export singleton instance
export const fallbackSearcher = new FallbackSimilaritySearcher();

// Export classes for testing
export { TFIDFVectorizer, cosineSimilarity, FallbackSimilaritySearcher };

/**
 * Example usage in Forge app:
 * 
 * import { fallbackSearcher } from './embeddings/fallback_similarity';
 * 
 * // Index a PR
 * await fallbackSearcher.indexItem('pr', 'myrepo/PR-123', prPayload, {
 *   risk_score: 85,
 *   repository: 'myorg/myrepo'
 * });
 * 
 * // Search for similar PRs
 * const similarPRs = await fallbackSearcher.searchSimilarPRs(newPrPayload, {
 *   topK: 5,
 *   threshold: 0.3
 * });
 * 
 * // Find related incidents
 * const incidents = await fallbackSearcher.findRelatedIncidents(prPayload, {
 *   topK: 5,
 *   daysBack: 90
 * });
 * 
 * console.log(`Found ${similarPRs.length} similar PRs`);
 * console.log(`Found ${incidents.length} related incidents`);
 */
