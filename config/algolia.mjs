import { algoliasearch } from "algoliasearch";
import dotenv from "dotenv";

dotenv.config();

const appID = process.env.ALGOLIA_APP_ID;
const apiKey = process.env.ALGOLIA_ADMIN_KEY;
const PostsIndexName =  'posts'
const UsersIndexName =  'users'

const client = algoliasearch(appID, apiKey);

export const addPostToAlgolia = async (post) => {
  const { id, title, snippet, language, description, github_link, posted_at } = post;
  const postObject = {
    objectID: id,
    title,
    snippet,
    language,
    description,
    github_link,
    posted_at,
  };

  try {
    const { taskID } = await client.saveObject({
      indexName : PostsIndexName,
      body: postObject,
    });
    await client.waitForTask({ indexName : PostsIndexName, taskID });
  } catch (error) {
    console.error("Error adding post to Algolia:", error);
  }
};

export const updatePostInAlgolia = async (post) => {
  const { id, title, snippet, language, description, github_link, posted_at } = post;
  const postObject = {
    objectID: id,
    title,
    snippet,
    language,
    description,
    github_link,
    posted_at,
  };

  try {
    const { taskID } = await client.saveObject({
      indexName : PostsIndexName,
      body: postObject,
    });
    await client.waitForTask({ indexName : PostsIndexName, taskID });
  } catch (error) {
    console.error("Error updating post in Algolia:", error);
  }
};

export const deletePostFromAlgolia = async (postId) => {
  try {
    const { taskID } = await client.deleteObject({
      indexName : PostsIndexName,
      objectID: postId,
    });
    await client.waitForTask({ indexName : PostsIndexName, taskID });
  } catch (error) {
    console.error("Error deleting post from Algolia:", error);
  }
};


export const addUserToAlgolia = async (user) => {
    const { id, firstname, lastname, username, profile_pic, created_at } = user;
    const userObject = {
      objectID: id,
      firstname,
      lastname,
      username,
      profile_pic,
      created_at,
    };
  
    try {
      const { taskID } = await client.saveObject({
        indexName : UsersIndexName,
        body: userObject,
      });
      await client.waitForTask({ indexName:UsersIndexName , taskID });
    } catch (error) {
      console.error("Error adding user to Algolia:", error);
    }
  };
  

export const updateUserInAlgolia = async (user) => {
    const { id, firstname, lastname, username, profile_pic, created_at } = user;
    const userObject = {
        objectID: id,
        firstname,
        lastname,
        username,
        profile_pic,
        created_at,
      };
    
  
    try {

      const { taskID } = await client.saveObject({
        indexName : UsersIndexName,
        body: userObject,
      });
      await client.waitForTask({ indexName:UsersIndexName , taskID });
    } catch (error) {
      console.error("Error updating user in Algolia:", error);
    }
  };
  
  
export const deleteUserFromAlgolia = async (userId) => {
    try {
      const { taskID } = await client.deleteObject({
        indexName : UsersIndexName,
        objectID: userId,
      });
      await client.waitForTask({ indexName : UsersIndexName, taskID });
    } catch (error) {
      console.error("Error deleting user from Algolia:", error);
    }
  };


// Function to search posts in Algolia
export const searchPostsInAlgolia = async (query) => {
  try {
    const { results } = await client.search({
      requests: [
        {
          indexName : PostsIndexName,
          query,
        },
      ],
    });
    return results[0].hits;
  } catch (error) {
    console.error("Error searching posts in Algolia:", error);
    return [];
  }
};


// Function to search users in Algolia
export const searchUsersInAlgolia = async (query) => {
    try {
      const { results } = await client.search({
        requests: [
          {
            indexName : UsersIndexName,
            query,
          },
        ],
      });
      return results[0].hits;
    } catch (error) {
      console.error("Error searching users in Algolia:", error);
      return [];
    }
  };
