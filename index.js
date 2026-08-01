import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { TavilySearch } from "@langchain/tavily";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import readline from "readline";
import "dotenv/config";


const cryptoTool = tool(
  async ({ coinId }) => {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
      const data = await res.json();
      return JSON.stringify(data);
    } catch (error) {
      return `Failed to fetch crypto price: ${error.message}`;
    }
  },
  {
    name: "get_crypto_price",
    description: "Fetch real-time cryptocurrency price for a given coin id (e.g., bitcoin, ethereum, solana)",
    schema: z.object({ coinId: z.string() }),
  }
);

//  TOOL CALLING: WEB SEARCH TOOL (For any general/news topics)
const searchTool = new TavilySearch({ maxResults: 3 });

// --- 3. INITIALIZE LLM & AGENT WORKFLOW WITH MEMORY ---
const model = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 });
const memorySaver = new MemorySaver();

const agent = createReactAgent({
  llm: model,
  tools: [cryptoTool, searchTool],
  checkpointSaver: memorySaver,
});

// --- 4. INTERACTIVE CLI CHAT INTERFACE ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function startAgentChat() {
  // Session configuration for state memory
  const config = { configurable: { thread_id: "interactive-session-1" } };

  console.log("==================================================");
  console.log("🤖 Smart Research AI Agent Ready!");
  console.log("Ask about web news, facts, crypto prices, or follow-up on past messages.");
  console.log("Type 'exit' or 'quit' to end the session.");
  console.log("==================================================\n");

  const askUser = () => {
    rl.question("\nYou: ", async (userInput) => {
      const inputTrimmed = userInput.trim();

      if (inputTrimmed.toLowerCase() === "exit" || inputTrimmed.toLowerCase() === "quit") {
        console.log("\n👋 Exiting Agent session. Goodbye!");
        rl.close();
        return;
      }

      if (!inputTrimmed) {
        askUser();
        return;
      }

      console.log("\n🤖 Agent is researching & thinking...\n");

      try {
        const response = await agent.invoke(
          { messages: [{ role: "user", content: inputTrimmed }] },
          config
        );

        const lastMessage = response.messages[response.messages.length - 1];
        console.log(`Agent: ${lastMessage.content}`);
      } catch (error) {
        console.error("Error invoking agent:", error.message);
      }

  
      askUser();
    });
  };

  askUser();
}

startAgentChat();