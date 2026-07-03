import { CitationPipeline } from '../lib/research/pipeline';

async function runTests() {
  const pipeline = new CitationPipeline();
  
  console.log("=== Running Deterministic Pipeline Tests ===");

  // 1. Valid SEC Quote
  console.log("\n--- Test 1: Valid SEC Quote ---");
  const validSecQuote = "The company experienced a 15% increase in gross margins during the third quarter compared to the prior year";
  const results1 = await pipeline.executeResearchJob('US', 'PLTR', [validSecQuote]);
  console.log("Verified Evidence:", results1.length);
  if (results1.length > 0) {
    console.log("Hash:", results1[0].canonicalTextHash);
  }

  // 2. Hallucinated SEC Quote (Altered percentage)
  console.log("\n--- Test 2: Hallucinated SEC Quote ---");
  const hallucinatedSecQuote = "The company experienced a 25% increase in gross margins during the third quarter compared to the prior year";
  const results2 = await pipeline.executeResearchJob('US', 'PLTR', [hallucinatedSecQuote]);
  console.log("Verified Evidence:", results2.length);

  // 3. Valid IDX Quote
  console.log("\n--- Test 3: Valid IDX Quote ---");
  const validIdxQuote = "Perseroan mencatatkan laba bersih sebesar Rp 1,5 Triliun pada kuartal ini";
  const results3 = await pipeline.executeResearchJob('ID', 'BBCA', [validIdxQuote]);
  console.log("Verified Evidence:", results3.length);

  // 4. Hallucinated IDX Quote (Added a sentence)
  console.log("\n--- Test 4: Hallucinated IDX Quote ---");
  const hallucinatedIdxQuote = "Perseroan mencatatkan laba bersih sebesar Rp 1,5 Triliun pada kuartal ini, dan membagikan dividen.";
  const results4 = await pipeline.executeResearchJob('ID', 'BBCA', [hallucinatedIdxQuote]);
  console.log("Verified Evidence:", results4.length);
}

runTests().catch(console.error);
