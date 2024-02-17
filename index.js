require('dotenv').config()
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const Post = require("./models/Post");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/",limits:{fieldSize: 25 * 1024 * 1024} } );
const fs = require("fs");

const salt = bcrypt.genSaltSync(10);
const secret = process.env.SECRET_KEY; 
const BASE_URL = process.env.BASE_URL;

app.use(cors({ credentials: true, origin: `${BASE_URL}` }));
app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static(__dirname + "/uploads"));

const PORT = process.env.PORT||4000;

mongoose.connect(
  process.env.CONNECTION_URL
);

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.log(e);
    res.status(400).json(e);
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
//   console.log(userDoc);
  if (userDoc == null) {
    //   console.log("yeah i am working inside the null");
    // alert("Invalid User.Please Try with valid userInformation");
    res.status(404).json("Invalid User.Please Try with valid userInformation");
  } else {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      //logged in
      jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
        if (err) throw err;
        res.cookie("token", token).json({
          id: userDoc._id,
          username,
        });
      });
    } else {
      res.status(400).json("wrong credentials.Plz try again later");
    }
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});  
 
app.post('/logout', (req,res) => {
  res.cookie('token', '').json('ok');
});

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split(".");
  const ext = parts[parts.length - 1];
  const newPath = path + "." + ext;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content } = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      author: info.id,
    });
    res.json(postDoc);
    // res.json(info);
  });
});

app.put('/post',uploadMiddleware.single("file"),async(req,res)=>{
    // res.json(req.file);
    let newPath = null;
    if(req.file){
        const { originalname, path } = req.file;
        const parts = originalname.split(".");
        const ext = parts[parts.length - 1];
        newPath = path + "." + ext;
        fs.renameSync(path, newPath); 
    }

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;

        const { id,title, summary, content } = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        // res.json({isAuthor,postDoc,info});
        if(!isAuthor){
            return res.status(400).json('You are not the author');   
        }
        await postDoc.updateOne({
            title,
            summary,
            content,
            cover:newPath?newPath :postDoc.cover,
        })
        res.json(postDoc);
      });
})

app.get("/post", async (req, res) => {
  // const posts = await Post.find();
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});



app.listen(PORT, () => {
  console.log(`Our blog app is listening to port ${PORT}`);
});

  