import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@^3";
const google = createGoogleGenerativeAI();
const model = google("gemini-3.5-flash-lite");
console.log("google@^3 spec:", model.specificationVersion);
