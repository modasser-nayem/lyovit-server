require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();

const corsConfig = {
   origin: "*",
   credentials: true,
   methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};

// middleware
app.use(cors(corsConfig));
app.options("", cors(corsConfig));
app.use(express.json());

// root route
app.get("/", (req, res) => {
   res.send(`<h1>Server is Running...</h1>`);
});

// verify jwt middleware function
const verifyJWT = async (req, res, next) => {
   const authorization = req.headers.authorization;
   if (!authorization) {
      return res
         .status(401)
         .send({ success: false, message: "unauthorized access" });
   }
   // bearer token
   const token = authorization.split(" ")[1];

   jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
         return res
            .status(401)
            .send({ success: false, message: "unauthorized access" });
      }
      req.decoded = decoded;
      next();
   });
};

//---------------------------------------------
//                Mongodb Start
//---------------------------------------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.p87lrd6.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: true,
   },
});

async function run() {
   try {
      await client.connect();
      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log(
         "Pinged your deployment. You successfully connected to MongoDB!"
      );

      // collections
      const userCollection = client.db("summer-camp-FLLS").collection("users");

      //<|---------------- Routes Start ------------------|>//
      // Create user
      app.post("/createUser", async (req, res) => {
         const { email, name, photoURL } = req.body;
         const user = await userCollection.findOne({ email });
         if (user) {
            return res.status(400).json({
               success: false,
               message: "User Already exist",
            });
         } else {
            const result = await userCollection.insertOne({
               name,
               email,
               photoURL,
               role: "student",
               selected_classes: [],
               enrolled_classes: [],
               payment: [],
               number_of_classes: 0,
               name_of_classes: [],
               classes: [],
               createdAt: Date.now(),
            });
            if (result.acknowledged) {
               res.status(201).json({
                  success: true,
                  message: "User Created Success",
               });
            } else {
               res.status(400).json({
                  success: false,
                  message: "User Created Failed!",
               });
            }
         }
      });

      // Create JWT
      app.post("/jwt", async (req, res) => {
         const { email } = req.body;
         const user = await userCollection.findOne({ email });
         if (user) {
            const token = jwt.sign({ email }, process.env.JWT_SECRET, {
               expiresIn: "1d",
            });
            res.status(200).json({
               success: true,
               token: "Bearer " + token,
            });
         } else {
            return res.status(400).json({
               success: false,
               message: "This user is not exist",
            });
         }
      });

      // verify Admin middleware function
      const verifyAdmin = async (req, res, next) => {
         const email = req.decoded.email;
         const user = await userCollection.findOne({ email });
         if (user.role !== "admin") {
            return res.status(403).json({
               success: false,
               message: "Forbidden Access",
            });
         }
         next();
      };

      //<|---------------- Routes End ------------------|>//
   } catch {
      console.log("Mongodb error");
   }
}
run().catch(console.dir);
// --------------------------------------------
//                Mongodb End
//---------------------------------------------

// Listen Server
const port = process.env.PORT || 5000;
app.listen(port, () => {
   console.log(`SERVER IS RUNNING AT http://localhost:${port}`);
});
