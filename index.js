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
// const uri = "mongodb://localhost:27017/educations";

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
      const classesCollection = client
         .db("summer-camp-FLLS")
         .collection("classes");
      const paymentCollection = client
         .db("summer-camp-FLLS")
         .collection("payment");

      //<|---------------- Routes Start ------------------|>//
      // Create user <> user <>
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
            const token = jwt.sign(
               { email: user.email, role: user.role },
               process.env.JWT_SECRET,
               {
                  expiresIn: "1d",
               }
            );
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

      // get single user
      app.get("/user", async (req, res) => {
         const email = req.query.email;
         const user = await userCollection.findOne({ email });
         if (user) {
            return res.status(200).json({
               success: true,
               data: user,
            });
         } else {
            return res.status(400).json({
               success: false,
               message: "User not found!",
            });
         }
      });

      // verify Admin middleware function
      const verifyAdmin = async (req, res, next) => {
         const email = req.decoded.email;
         const user = await userCollection.findOne(
            { email },
            {
               projection: {
                  role: 1,
               },
            }
         );
         if (user.role !== "admin") {
            return res.status(403).json({
               success: false,
               message: "Forbidden Access",
            });
         }
         next();
      };

      // verify Instructor middleware function
      const verifyInstructor = async (req, res, next) => {
         const email = req.decoded.email;
         const user = await userCollection.findOne(
            { email },
            {
               projection: {
                  role: 1,
               },
            }
         );
         if (user.role !== "instructor") {
            return res.status(403).json({
               success: false,
               message: "Forbidden Access",
            });
         }
         next();
      };

      // verify Student middleware function
      const verifyStudent = async (req, res, next) => {
         const email = req.decoded.email;
         const user = await userCollection.findOne(
            { email },
            {
               projection: {
                  role: 1,
               },
            }
         );
         if (user.role !== "student") {
            return res.status(403).json({
               success: false,
               message: "Forbidden Access",
            });
         }
         next();
      };

      // Select a class <> Student <> (req.body=id)
      app.post("/select-class", verifyJWT, verifyStudent, async (req, res) => {
         const _id = req.body.id;
         const query = { email: "nayem@gmail.com" || req.decode.email };
         const result = await userCollection.updateOne(query, {
            $addToSet: {
               selected_classes: _id,
            },
         });
         if (result.modifiedCount) {
            return res.status(200).json({
               success: true,
               message: "Selected Class",
            });
         } else if (result.modifiedCount === 0) {
            return res.status(400).json({
               success: false,
               message: "Class not selected",
            });
         }
         res.status(500).json({
            success: false,
            message: "Server error",
         });
      });

      // My selected class <> Student <>
      app.get(
         "/my-selected-class",
         verifyJWT,
         verifyStudent,
         async (req, res) => {
            const email = req.decoded.email;
            const user = await userCollection.findOne({ email });
            if (user) {
               const selectedClass = user.selected_classes;
               let classes = [];
               for (id in selectedClass) {
                  classes = await classesCollection
                     .find(
                        {
                           _id: new ObjectId(selectedClass[id]),
                        },
                        {
                           projection: {
                              class_id: 1,
                              class_name: 1,
                              img: 1,
                              instructor_name: 1,
                              seats: 1,
                              price: 1,
                           },
                        }
                     )
                     .toArray();
               }
               if (classes) {
                  return res.json({
                     success: true,
                     data: classes,
                  });
               }
               res.json({
                  success: false,
                  message: "server error",
               });
            }
         }
      );

      // My Enrolled class <> Student <>
      app.get(
         "/my-enrolled-class",
         verifyJWT,
         verifyStudent,
         async (req, res) => {
            const email = req.decoded.email;
            const user = await userCollection.findOne({ email });
            const enrolledClass = user.enrolled_classes;
            let classes = [];
            for (id in enrolledClass) {
               classes = await classesCollection
                  .find(
                     {
                        _id: new ObjectId(enrolledClass[id]),
                     },
                     {
                        projection: {
                           class_id: 1,
                           class_name: 1,
                           img: 1,
                           instructor_name: 1,
                           seats: 1,
                           price: 1,
                        },
                     }
                  )
                  .toArray();
            }
            if (classes) {
               return res.json({
                  success: true,
                  data: classes,
               });
            }
            res.json({
               success: false,
               message: "server error",
            });
         }
      );

      // Enrolled a Class <> Student <> (req.body)
      app.post("/payment", verifyJWT, verifyStudent, async (req, res) => {
         const {
            class_id,
            class_name,
            img,
            author_id,
            amount,
            date,
            transaction_id,
         } = req.body;
         const exist = await userCollection.findOne({
            _id: new ObjectId(author_id),
         });
         const availableSeat = await classesCollection.findOne({
            _id: new ObjectId(class_id),
         });
         if (availableSeat.seats > 0) {
            if (!exist.enrolled_classes.includes(class_id)) {
               const result = await paymentCollection.insertOne(req.body);
               if (!result) {
                  return res.status(500).json({
                     success: false,
                     message: "server error",
                  });
               }
               if (result.insertedId) {
                  const updateClass = await classesCollection.updateOne(
                     { _id: new ObjectId(class_id) },
                     {
                        $inc: {
                           enrolled_students: 1,
                           seats: -1,
                        },
                     }
                  );
                  const updateUser = await userCollection.updateOne(
                     { _id: new ObjectId(author_id) },
                     {
                        $pull: {
                           selected_classes: class_id,
                        },
                        $addToSet: {
                           enrolled_classes: class_id,
                           payment: result.insertedId,
                        },
                     }
                  );
                  if (updateClass.modifiedCount && updateUser.modifiedCount) {
                     return res.status(201).json({
                        success: true,
                        message: "Class Enrolled Success",
                        updateClass,
                        updateUser,
                     });
                  } else {
                     await paymentCollection.deleteOne({
                        _id: result.insertedId,
                     });
                     return res.status(201).json({
                        success: false,
                        message: "Class Enrolled Failed!",
                        updateClass,
                        updateUser,
                     });
                  }
               } else {
                  return res.status(500).json({
                     success: false,
                     message: "server error",
                  });
               }
            } else {
               return res.status(400).json({
                  success: false,
                  message: "Already Enrolled",
               });
            }
         } else {
            return res.status(400).json({
               success: false,
               message: "Seat Not Available",
            });
         }
      });

      // Popular classes <> Public <>
      app.get("/popular-classes", async (req, res) => {
         const popularClasses = await classesCollection
            .find(
               {},
               {
                  projection: {
                     _id: 1,
                     // class_id: 1,
                     class_name: 1,
                     img: 1,
                     instructor_name: 1,
                     seats: 1,
                     price: 1,
                  },
               }
            )
            .sort({ enrolled_students: -1 })
            .limit(6)
            .toArray();
         if (popularClasses) {
            return res.status(200).json({
               success: true,
               data: popularClasses,
            });
         }
         res.status(500).json({
            success: false,
            message: "server error",
         });
      });

      // Popular Instructors <> Public <> TODO: not implement
      app.get("/popular-instructor", async (req, res) => {
         const classes = await classesCollection
            .find(
               {},
               {
                  projection: {
                     enrolled_students: 1,
                  },
               }
            )
            .toArray();
         const popularInstructor = await userCollection.find().toArray();
         if (popularInstructor) {
            return res.status(200).json({
               success: true,
               data: popularInstructor,
            });
         }
         res.status(500).json({
            success: false,
            message: "server error",
         });
      });

      // add a class <> Instructor <> (req.body)
      app.post("/class", verifyJWT, verifyInstructor, async (req, res) => {
         const {
            class_name,
            img,
            instructor_name,
            instructor_email,
            seats,
            price,
         } = req.body;
         const doc = {
            class_name,
            img,
            instructor_name,
            instructor_email,
            seats,
            price,
            enrolled_students: 0,
            status: "pending",
            feedback: "",
         };
         const result = await classesCollection.insertOne(doc);
         if (result.insertedId) {
            const user = await userCollection.findOne({
               email: instructor_email,
            });
            const updateDoc = await userCollection.updateOne(
               { email: instructor_email },
               {
                  $set: {
                     number_of_classes: user.number_of_classes + 1,
                     name_of_classes: [...user.name_of_classes, class_name],
                  },
               }
            );
            if (updateDoc.modifiedCount) {
               return res.status(201).json({
                  success: true,
                  message: "Class Created Success",
               });
            } else {
               await classesCollection.deleteOne({
                  _id: new ObjectId(result.insertedId),
               });
               return res.status(400).json({
                  success: false,
                  message: "Class Created Failed!",
               });
            }
         } else {
            return res.status(400).json({
               success: false,
               message: "Class Created Failed!",
            });
         }
      });

      // My classes <> Instructor <>
      app.get("/my-classes", verifyJWT, verifyInstructor, async (req, res) => {
         const email = req.decoded.email;
         const myClasses = await classesCollection
            .find({ instructor_email: email })
            .toArray();
         if (myClasses) {
            return res.status(200).json({
               success: true,
               data: myClasses,
            });
         } else {
            return res.status(404).json({
               success: false,
               data: myClasses,
            });
         }
      });

      // update class <> Instructor <> (params=id, req.body)
      app.patch("/class/:id", verifyJWT, verifyInstructor, async (req, res) => {
         const { id } = req.params;

         const result = await classesCollection.updateOne(
            { _id: new ObjectId(id) },
            {
               $set: req.body,
            }
         );
         if (result.modifiedCount) {
            return res.status(200).json({
               success: true,
               message: "Class Updated",
            });
         } else {
            return res.status(400).json({
               success: false,
               message: "Class Updated Failed!",
            });
         }
      });

      // Get single class <> public <>
      app.get("/class/:id", verifyJWT, async (req, res) => {
         const { id } = req.params;
         const result = await classesCollection.findOne({
            _id: new ObjectId(id),
         });
         if (result) {
            return res.status(200).json({
               success: true,
               data: result,
            });
         } else {
            return res.status(200).json({
               success: false,
               message: "this class is not exist",
            });
         }
      });

      // delete a class <> Instructor <>

      // get all classes <> Admin || public <>
      app.get("/classes", async (req, res) => {
         const classes = await classesCollection.find().toArray();
         res.status(200).json({
            success: true,
            data: classes,
         });
      });

      // get all users <> Admin <>
      app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
         const options = {
            // sort returned documents in ascending order by title (A->Z)
            // sort: { name: 1 },
            projection: {
               _id: 1,
               name: 1,
               email: 1,
               photoURL: 1,
               role: 1,
               createdAt: 1,
            },
         };
         const users = await userCollection.find({}, options).toArray();
         if (users) {
            return res.status(200).json({
               success: true,
               data: users,
            });
         } else {
            return res.status(500).json({
               success: false,
               message: "Server error",
            });
         }
      });

      // manage user role <> Admin <> (params=id, query=role)
      app.patch(
         "/update-role/:id",
         verifyJWT,
         verifyAdmin,
         async (req, res) => {
            const { id } = req.params;
            const updateRole = req.query.role;
            const user = await userCollection.updateOne(
               { _id: new ObjectId(id) },
               {
                  $set: {
                     role: updateRole,
                  },
               }
            );
            if (user.modifiedCount) {
               return res.status(200).json({
                  success: true,
                  message: `Update to ${updateRole}`,
               });
            } else {
               return res.status(400).json({
                  success: false,
                  message: "Update Failed!",
               });
            }
         }
      );

      // manage Classes Status <> Admin <> (params=id, query=status)
      app.patch(
         "/class-status/:id",
         verifyJWT,
         verifyAdmin,
         async (req, res) => {
            const { id } = req.params;
            const updateStatus = req.query.status;
            const result = await classesCollection.updateOne(
               { _id: new ObjectId(id) },
               {
                  $set: {
                     status: updateStatus,
                  },
               }
            );
            if (result.modifiedCount) {
               return res.status(200).json({
                  success: true,
                  message: `Class is ${updateStatus}`,
               });
            } else {
               return res.status(400).json({
                  success: false,
                  message: `Class ${updateStatus} Failed!`,
               });
            }
         }
      );

      // manage Classes feedback <> Admin <> (params=id, req.body)
      app.patch(
         "/class-feedback/:id",
         verifyJWT,
         verifyAdmin,
         async (req, res) => {
            const { id } = req.params;
            const { feedback } = req.body;
            const result = await classesCollection.updateOne(
               { _id: new ObjectId(id) },
               {
                  $set: {
                     feedback: feedback,
                  },
               }
            );
            if (result.modifiedCount) {
               return res.status(200).json({
                  success: true,
                  message: `Send Feedback`,
               });
            } else {
               return res.status(400).json({
                  success: false,
                  message: `Feedback Send Failed!`,
               });
            }
         }
      );

      //<|---------------- Routes End ------------------|>//
   } catch {
      console.log("Mongodb connection error");
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
