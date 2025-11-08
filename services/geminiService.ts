
import { GoogleGenAI, Type } from "@google/genai";
import { OptimizedRouteResponse } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function extractAddressesFromImage(base64Image: string, mimeType: string): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: `
            You are an expert Optical Character Recognition (OCR) system specializing in postal addresses.
            Analyze the provided image and extract all complete postal addresses.

            Your response MUST be a valid JSON array of strings.
            - Each string in the array should be a single, complete postal address.
            - If no addresses are found, return an empty array: [].
            - Do not include any text, explanations, or markdown formatting outside of the JSON array.

            Example of a valid response:
            ["1600 Amphitheatre Parkway, Mountain View, CA", "1 Infinite Loop, Cupertino, CA, 95014"]
          `,
        },
      ],
    },
    config: {
        responseMimeType: "application/json",
    }
  });

  try {
    const jsonString = response.text.trim();
    // Handle potential markdown code block fences
    const cleanedJsonString = jsonString.replace(/^```json\s*|```$/g, '');
    const addresses = JSON.parse(cleanedJsonString);
    if (Array.isArray(addresses) && addresses.every(item => typeof item === 'string')) {
      return addresses;
    }
    throw new Error("Invalid JSON format from API");
  } catch (error) {
    console.error("Failed to parse addresses from Gemini response:", response.text, error);
    throw new Error("Could not parse addresses from the image.");
  }
}

export async function getRouteDetails(addresses: string[]): Promise<OptimizedRouteResponse> {
  const prompt = `
    You are a sophisticated route planning and logistics API. Your task is to process a list of addresses and return several detailed, optimized travel plan alternatives.

    Given the following list of addresses:
    ${JSON.stringify(addresses)}

    You must perform the following actions and return 2-3 distinct route options:
    1.  For each address, find its precise geographic coordinates (latitude and longitude). This should be consistent across all route options.
    2.  For each route option, determine a unique and efficient travel order based on these rules:
        - The route MUST start at the first address in the list: "${addresses[0]}".
        - The route MUST end at the last address in the list: "${addresses[addresses.length - 1]}".
        - All other addresses are intermediate waypoints. Find an optimal order to visit these waypoints.
        - Each route option should prioritize a different factor (e.g., fastest time, shortest distance, avoiding traffic, scenic route).
    3.  For each route option, provide a clear label (e.g., "Fastest Route", "Shortest Distance") and a brief description explaining its characteristics (e.g., "Avoids highways but is longer.", "Quickest option with current traffic.").
    4.  For each route option, calculate the total driving distance (in meters) and total duration (in seconds).
    5.  For each leg of each route option, calculate the driving distance (in meters), duration (in seconds), and provide a comprehensive list of HYPER-DETAILED, granular, human-friendly, turn-by-turn driving directions. The goal is to generate as many steps as possible, breaking down the journey into its smallest components.
        - **Maximum Granularity:** Provide instructions for every single turn, fork in the road, lane merge, and roundabout exit. Do not consolidate multiple maneuvers into one step.
        - **Street and Highway Names are Mandatory:** Every instruction MUST include the full name of the street, highway, or exit. Include exit numbers where applicable.
        - **Frequent Distance Markers:** Each step must specify the distance to the next maneuver, even for short segments.
        - **Lane Guidance:** Explicitly mention which lane(s) to be in (e.g., "Use the right 2 lanes to turn right onto Main St.").
        - **Detailed Landmark and Cross-Street References:** Mention prominent landmarks (e.g., "Pass the City Hall on your left"), cross-streets ("Continue past Oak Ave"), and specific visual cues ("Turn right at the gas station with the red sign").
        - **Clear Verbs:** Use precise and unambiguous driving instructions like "Make a slight right onto...", "Keep left at the fork...", "Take the 3rd exit from the roundabout...".
        - **Generate a high volume of steps.** More detail is always better. The directions should be so clear that a driver could navigate with minimal reliance on a visual map.

    Your response MUST be a single JSON array, where each object in the array represents a distinct route option and strictly adheres to the provided schema. Do not include any other text, explanations, or markdown formatting. The first option in the array should be the most recommended one.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        description: "A list of alternative route options.",
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING, description: "A short label for the route (e.g., 'Fastest Route')." },
            description: { type: Type.STRING, description: "A brief description of the route's characteristics." },
            totalDistance: { type: Type.INTEGER, description: "Total distance in meters for the entire route." },
            totalDuration: { type: Type.INTEGER, description: "Total duration in seconds for the entire route." },
            stops: {
              type: Type.ARRAY,
              description: "An array of geocoded stops, in the original order.",
              items: {
                type: Type.OBJECT,
                properties: {
                  originalAddress: { type: Type.STRING },
                  lat: { type: Type.NUMBER },
                  lng: { type: Type.NUMBER },
                },
                required: ["originalAddress", "lat", "lng"],
              },
            },
            optimizedOrder: {
              type: Type.ARRAY,
              description: "An array of numbers representing the original indices of the stops in the new, optimized order for this route.",
              items: { type: Type.INTEGER },
            },
            legs: {
              type: Type.ARRAY,
              description: "An array of objects, each describing a leg of the journey for this route.",
              items: {
                type: Type.OBJECT,
                properties: {
                  distance: { type: Type.INTEGER, description: "Distance in meters" },
                  duration: { type: Type.INTEGER, description: "Duration in seconds" },
                  directions: {
                      type: Type.ARRAY,
                      description: "A list of human-friendly turn-by-turn instructions for this leg.",
                      items: { type: Type.STRING }
                  },
                },
                required: ["distance", "duration", "directions"],
              },
            },
          },
          required: ["label", "description", "totalDistance", "totalDuration", "stops", "optimizedOrder", "legs"],
        }
      },
    },
  });

  try {
    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    
    // Basic validation
    if (!Array.isArray(result) || result.length === 0) {
        throw new Error("Incomplete data from API");
    }
    return result as OptimizedRouteResponse;
  } catch (error) {
    console.error("Failed to parse route details from Gemini response:", response.text, error);
    throw new Error("Could not calculate route details.");
  }
}