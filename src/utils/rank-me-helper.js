import { logToFirestore } from "@/services/firebase.utils";
import { apiFetch } from "@/services/api-service";
/**
 * Fetches rank data from the API
 * @param {number} entries - Number of entries to get rank for
 * @returns {Promise<Object>} - Promise that resolves to rank data
 */
const fetchRankMe = async (entries) => {
  try {
    return await apiFetch(`rank-me?entries=${entries}`, {
      method: "GET"
    });
  } catch (error) {
    // Log the error to firestore
    await logToFirestore("Failed to get rank", "error", { error });
    return { input: "😕", error: error.message };
  }
};

export default fetchRankMe;
