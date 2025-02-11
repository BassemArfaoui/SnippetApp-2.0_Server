import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv"


dotenv.config();



//cloud config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  
  //multer config
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "profile_pictures",  
      allowed_formats: ["jpg", "png", "jpeg", "svg" ],  

    },
  });
  const upload = multer({ storage });


  export default upload;