import { algoliasearch } from "algoliasearch";
import dotenv from "dotenv";
import db from "./config/postgres.mjs"; // Ensure this file exports your database query interface

dotenv.config();
db.connect();

const appID = process.env.ALGOLIA_APP_ID;
const apiKey = process.env.ALGOLIA_ADMIN_KEY;
const indexName = "posts";

const client = algoliasearch(appID, apiKey);

async function uploadAllPostsToAlgolia() {
  try {
    // Retrieve all posts from your database
    const { rows } = await db.query(
      `SELECT id, title, snippet, language, description, posted_at FROM post`
    );

    if (!rows || rows.length === 0) {
      console.log("No posts found in the database to upload.");
      return;
    }

    // Iterate over each post and upload it individually
    for (const post of rows) {
      const object = {
        objectID: post.id,          // Unique identifier for Algolia
        title: post.title || '',    // Default to empty string if undefined
        snippet: post.snippet || '',// Default to empty string if undefined
        language: post.language || '',// Default to empty string if undefined
        description: post.description || '',// Default to empty string if undefined
        posted_at: post.posted_at || '',// Default to empty string if undefined
      };

      // Upload the individual object to Algolia
      const { taskID } = await client.saveObjects({
        indexName,
        body: [object],
      });

      // Wait until Algolia completes indexing for this object
      await client.waitForTask({ indexName, taskID });

      console.log(`Successfully uploaded post with ID ${post.id} to Algolia.`);
    }
  } catch (error) {
    console.error("Error uploading posts to Algolia:", error.message);
  }
}

// Execute the bulk upload
uploadAllPostsToAlgolia();
