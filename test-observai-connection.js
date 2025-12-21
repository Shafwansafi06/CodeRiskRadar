const { ObservAIClient } = require('@observai/sdk');

async function test() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not found in environment');
        process.exit(1);
    }

    const config = {
        apiKey,
        projectId: 'pitstop-ai-forge',
        userId: '1bd4c817-2638-495d-be3a-4809b3e648ea',
        trackingEndpoint: 'https://nztdwsnmttwwjticuphi.supabase.co/functions/v1/track-llm',
        batchMode: true
    };

    const client = new ObservAIClient(config);

    const modelsToTry = [
        'gemini-1.5-flash-001',
        'gemini-1.5-flash-002',
        'gemini-1.5-pro',
        'gemini-pro',
        'gemini-2.0-flash-exp'
    ];

    console.log('🔍 Testing available models to find a working one...');

    for (const model of modelsToTry) {
        console.log(`\n⏳ Testing model: ${model}...`);
        try {
            const result = await client.generateContent(
                model,
                'Hello',
                { metadata: { feature: 'test' } }
            );
            console.log(`✅ SUCCESS with ${model}!`);
            console.log('Sample response:', result.response ? 'Has Response' : 'No Response');
            return; // Exit on first success
        } catch (e) {
            console.log(`❌ Failed with ${model}:`);
            if (e.response && e.response.data && e.response.data.error) {
                console.log(`   Error: ${e.response.data.error.message}`);
            } else if (e.message) {
                console.log(`   Error: ${e.message}`);
            } else {
                console.log(`   Error: ${JSON.stringify(e)}`);
            }
        }
    }

    console.log('\n❌ All models failed.');
}

test();
