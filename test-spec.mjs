import { createGoogleGenerativeAI } from "@ai-sdk/google";
const google = createGoogleGenerativeAI();
const model = google("gemini-1.5-flash");
console.log("Specification version:", model.specificationVersion);
