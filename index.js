import express from "express";
import pg from "pg";
import path from "path";
import bodyParser from "body-parser"
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import session from "express-session";
import passport from "passport";
import  LocalStrategy from "passport-local";
import flash from "connect-flash";
import bcrypt from "bcrypt";
// import { fail } from "assert";
// import connectRedis from 'connect-redis';
// import { createClient } from 'redis';
// const upload = multer({ dest: 'uploads/' });
// const bodyParser = require('body-parser');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app=express();
const port=3000;
app.use(bodyParser.json());                         //If you get any error in POST check this and next line
app.use(express.urlencoded({extended:true}));

app.use(flash());

app.use(express.static(__dirname + '/public'));

const db=new pg.Client({
    user:"postgres",
    host:"localhost",
    database:"tasty_tales",
    password:"password",
    port:5432,
});
db.connect();
// app.get("/",(req,res)=>{
 
//     res.render("index.ejs");
// });

app.use(
  session({
    secret:"THISISASECRET",
    resave:false,
    saveUninitialized:false,
    failureFlash: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
    saltRounds:5
  })
)

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    {
      usernameField: "email", // assuming email is used for authentication
      passwordField: "password",
    },
    async function (email, password, cb) {
      try {

        const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);

        if (result.rows.length > 0) {
          const user = result.rows[0];
          // console.log(password,user.password)
          await bcrypt.compare(password,user.password,async (err,res)=>{
            if(err){
              console.log("Error in comparing passwords");
            }
            else{
              if(res){
                // if (user.password === password) {
                  return cb(null, user);
                // } else {
                  // return cb(null, false, { message: "Incorrect password" });
                // }
              }
              else{
                return cb(null, false, { message: "Incorrect password" });
              }
            }
          })
          // console.log(password);
          // console.log(user.password);
          // if (user.password === password) {
          //   return cb(null, user);
          // } else {
          //   return cb(null, false, { message: "Incorrect password" });
          // }
        } else {
          return cb(null, false, { message: "User not found try registering" });
        }
      } catch (err) {
        console.error("Error in logging in:", err);
        return cb(err);
      }
    }
  )
);

passport.serializeUser((user, cb) => {
  // console.log(user)
  cb(null, user); // assuming user.id is unique
});


passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.get("/signup",(req,res)=>{
  const messages = req.flash();
  res.render("signup.ejs",{
    messages:messages
  });
});

app.get("/login", (req, res) => {
  const messages = req.flash();
  res.render("login.ejs", { messages: messages });
});

app.get("/logout",(req,res)=>{
  req.logout(err=>{
    if(err){
      console.log("Errot in logout");
      return next(err);
    }
    else{
      req.session.destroy(err=>{
        if(err){
          console.log("Error in destroying session");
          return next(err);
        }
        else{
          res.redirect("/");
        }
      })
    }
  })
})

app.post("/signup",async (req,res)=>{
  const username=req.body["name"];
  const email=req.body["email"];
  let password=req.body["password"];
  const confirmPassword=req.body["confirmPassword"];
  // console.log(username,email,password)
  const searchResult=await db.query("SELECT * FROM users WHERE email=$1",[email]);
  // console.log(searchResult.rows);
  if(searchResult.rows.length==0){
    if(confirmPassword==password){
      password=await bcrypt.hash(password,5);
      // console.log(axi);
      const insertResult=await db.query("INSERT INTO users(username,email,password) VALUES($1,$2,$3) RETURNING *",[username,email,password]);
      const user=insertResult.rows[0];
      req.login(user,err=>{
        if(err){
          console.error("Error during login:", err);
        }
        // console.log("Success");
        res.redirect("/");
      })
    }
    else{
      req.flash("error", "Passwords do not match");
      res.redirect("/signup");
    }

  }
  else{
    req.flash("error", "Username already exists try login");
    res.redirect("/login");
  }
});



app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash:true
  })
);

// app.post("/login", passport.authenticate("local", {

//   successRedirect: res.redirect("/"),
//   failureRedirect: "/login",
//   failureFlash: true
// }));




app.use((req, res, next) => {
  res.locals.user = req.user; // Assuming req.user contains authenticated user data
  next();
});


app.get("/", (req, res) => {
  // console.log(req.user)
 
  if (req.isAuthenticated()) {
    const user=req.user;
    res.render("index.ejs",{
      user:user
    });
    // console.log("Authenticated");
  } else {
    res.render("index.ejs");
    // console.log("NOT Authenticated");
  }
});

app.get("/myrecipe",async (req,res)=>{
  if(req.user){
  // console.log(req.user)
  const userId=req.user.user_id;
  // console.log(userId)
  const searchResult=await db.query(
`SELECT *
FROM "Indian_Cuisine"
WHERE user_id = $1
UNION 
SELECT *
FROM "Chineese_Cuisine"
WHERE user_id = $1
UNION 
SELECT *
FROM "American_Cuisine"
WHERE user_id = $1
UNION 
SELECT *
FROM "Italian_Cuisine"
WHERE user_id = $1
UNION 
SELECT *
FROM "Healthful_Eats"
WHERE user_id = $1
UNION
SELECT *
FROM "Sweet_Cafe_Delights"
WHERE user_id = $1
`,[userId]);
  // console.log(searchResult.rows[0]);
  const data=[];
  searchResult.rows.forEach(e => {
    data.push({itemImage:e.item_image.toString("base64"),itemName:e.item_name,itemId:e.item_id,cuisineId:e.cuisine_id})
  });
  // console.log(data)
  res.render("myrecipe.ejs",{
    data:data
  })
  }
  else{
  res.send("<div>No data to show</div>");
  }
})


app.post("/delete", async (req, res) => {
  try {
    const itemId = req.query.item_id;
    const cuisineId = req.query.cuisine_id;
    if (!itemId || !cuisineId) {
      return res.status(400).json({ error: "item_id and cuisine_id are required" });
    }

    // await db.query(`DELETE FROM "Indian_Cuisine" WHERE item_id = $1 AND cuisine_id = $2`, [itemId, cuisineId]);
    const cuisineResult=await db.query(`SELECT cuisine_name FROM cuisine WHERE cuisine_id=$1`,[cuisineId]);
    const cuisineName=cuisineResult.rows[0].cuisine_name;
    await db.query(`
DELETE FROM "${cuisineName}"
WHERE item_id = $1 AND cuisine_id = $2;
   `, [itemId, cuisineId]);
    // res.status(200).json({ message: "Item deleted successfully" });
    res.redirect("/myrecipe");
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: "An error occurred while deleting the item" });
  }
});




app.post("/modify", async (req, res) => {
  try {
    // console.log(req.query);
    const itemId = req.query.item_id;
    const cuisineId = req.query.cuisine_id;
    const cuisineResult=await db.query("SELECT cuisine_name FROM cuisine WHERE cuisine_id=$1",[cuisineId]);
    const cuisineName=cuisineResult.rows[0].cuisine_name;
    // const modify=true;
    const searchResult=await db.query(`SELECT * FROM "${cuisineName}" WHERE item_id=$1 AND cuisine_id=$2`,[itemId,cuisineId]);
    // ingredients=ingredients.slice(" ");
    let ingred=[];
    let steps=[];
for(let i=0;i<searchResult.rows[0].ingredients.length;i++){
  ingred.push(searchResult.rows[0].ingredients[i]);
}
for(let i=0;i<searchResult.rows[0].process.length;i++){
  steps.push(searchResult.rows[0].process[i]);
}
    // console.log(searchResult.rows[0].ingredients[0])
    res.render("forms.ejs",{
      cuisineName:cuisineName,
      modify:true,
      ingredients:ingred,
      steps:steps,
      recipeTitle:searchResult.rows[0].item_name,
      itemId,
      cuisineId
    })
  } catch (error) {
    console.error('Error modifying item:', error);
    res.status(500).json({ error: "An error occurred modifying the item" });
  }
});

app.get("/contact",(req,res)=>{
  res.render("contact.ejs");
})

app.get("/:cuisine/:variety/addnew/",(req,res)=>{
  let cuisineName=req.params.cuisine;
  let varietyName=req.params.variety;
  let modify=false;
  // console.log(req.user)
  // if(req.isAuthenticated()){
  // console.log(varietyName)
  res.render("forms.ejs",{
    cuisineName,
    varietyName,
    modify:false
  });
// }
// else{
//   req.flash("Error", "You must be logged in to add a new item.");
//   // req.session.returnTo = req.originalUrl;
//   res.redirect(`/login`);
// }
})


app.get('/:type', async (req, res) => {
  let cuisineName = req.params.type;
    try {
      const cuisineResult = await db.query('SELECT cuisine_id FROM cuisine WHERE cuisine_name = $1', [cuisineName]);
  
      if (cuisineResult.rows.length === 0) {
        return res.status(404).send('Cuisine not found');
      }
  
      const cuisineId = cuisineResult.rows[0].cuisine_id;
      // console.log(typeof(cuisineId))
    //   const imageResult = await db.query('SELECT item_image FROM items WHERE item_id = $1', [cuisineId]);

    const imageResult = await db.query('SELECT cuisine_image FROM cuisine WHERE cuisine_id = $1', [cuisineId])
      if (imageResult.rows.length === 0) {
        return res.status(404).send('Image not found');
      }

      // const itemResult=await db.query("SELECT item_name,item_image FROM items WHERE cuisine_id=$1",[cuisineId]);
      // if (itemResult.rows.length === 0) {
      //   return res.status(404).send('Could not able to load images');
      // }
      // console.log(itemResult.rows.length)
      const imageData = imageResult.rows[0].cuisine_image.toString('base64');

      if(cuisineId===5 || cuisineId===6){
        var varietyData=await db.query("SELECT variety_name,variety_id FROM variety WHERE cuisine_id=$1 ORDER BY variety_id",[cuisineId]);
      }
      else{
      var varietyData=await db.query("SELECT variety_name,variety_id FROM variety WHERE cuisine_id=1 ORDER BY variety_id");
      }
      const data=[];
      let item=[];

      let count=-1;
      for(let i=0;i<4;i++){
        item=[];

        let itemResult=await db.query(`SELECT item_name,item_image FROM "${cuisineName}" WHERE cuisine_id=$1 AND variety_id=$2`,[cuisineId,varietyData.rows[i].variety_id]);

        // console.log(itemResult.rows.length,"NEXT");
        for(let j=0;j<4;j++){
          count++;
          item.push({item_name:itemResult.rows[j].item_name,item_image:itemResult.rows[j].item_image.toString('base64')});
        }


        data.push({variety_name:varietyData.rows[i].variety_name, items:item});
      }

      
      const itemNames=[];
      const itemImages=[];
      // itemResult.rows.forEach(e => {
      //   itemNames.push(e.item_name);
      //   itemImages.push(e.item_image.toString('base64'));
      // });
      // console.log(itemNames);
      cuisineName = cuisineName.replaceAll("_", " ");
      res.render("cuisine.ejs", {
        cuisineName,
        imageData,
        // itemImages,
        // itemNames,
        data,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
  });



  app.get('/:cuisine/:variety/',async (req,res)=>{
    // res.send("Loading");
    try{
    let cuisineName=req.params.cuisine;
    let varietyName=req.params.variety;
    // console.log(cuisineName,varietyName);
    cuisineName=cuisineName.replaceAll(" ","_");
    // console.log(cuisineName);
  let cuisineResult=await db.query("SELECT cuisine_id FROM cuisine WHERE cuisine_name=$1",[cuisineName]);
  let cuisineId=cuisineResult.rows[0].cuisine_id;
  // console.log(cuisineId)
  if(cuisineId<5){
    cuisineId=1;
  }
  let varietyResult=await db.query("SELECT variety_id FROM variety WHERE variety_name=$1 AND cuisine_id=$2",[varietyName,cuisineId]);
  // console.log("next",varietyResult.rows);
  // const varietyId=varietyResult.rows[0].variety_id;
// console.log("Ok",4varietyResult.rows[0].variety_id)

  let itemResult=await db.query(`SELECT item_name,item_image,item_id FROM "${cuisineName}" WHERE variety_id=$1 ORDER BY item_id`,[varietyResult.rows[0].variety_id]);
  // console.log(itemResult.rows)
  let leng=itemResult.rows.length;
  let data=[];
  for(let i=0;i<leng;i++){
    data.push({itemId:itemResult.rows[i].item_id,itemName:itemResult.rows[i].item_name,itemImage:itemResult.rows[i].item_image.toString('base64')})
  }
  // console.log(data);
  res.render("items.ejs",{
    data,
    leng,
    varietyName,
    cuisineName
  });
    }
  catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
  });


app.get("/:cuisine/:variety/:item",async (req,res)=>{
  // console.log(req.query.id)
  const itemId=req.query.id;
  let cuisineName=req.params.cuisine;
  cuisineName=cuisineName.replaceAll(" ","_")
  // const varietyname=req.params.variety;
  const itemName=req.params.item;
  // console.log(cuisineName,varietyname,itemId);
// if(isAuthenticated()){

// }
// else{
//   res.flash("Please login to view the recipe")
//   res.redirect("/login")
// }
  try{
    const itemResult=await db.query(`SELECT * FROM "${cuisineName}" WHERE item_id=$1`,[itemId]);
    // console.log((itemResult.rows[0].nutritional_facts));
    const nutritional_values=(itemResult.rows[0].nutritional_facts);
    let ingredients=(itemResult.rows[0].ingredients);
    let steps=(itemResult.rows[0].process);
    if(steps.length==0){
      res.status(404).send("No details found")
    }
    // console.log()
    res.render("recipe.ejs",{
      itemName,
      ingredients:ingredients,
      steps:steps,
      imageData:itemResult.rows[0].item_image.toString('base64'),
      nutrition:nutritional_values,
      likes:itemResult.rows[0].likes,
      cuisineName:cuisineName,
      itemId:itemResult.rows[0].item_id
    });
  }
  catch{
    res.send("No details found");
  }
})

app.post('/:cuisine/:id/update-like',async (req,res)=>{
  // console.log(req.params.x);
  const cuisineName=req.params.cuisine;
  const itemId=req.params.id
  const {newLikeCount} = req.body;
  // const likeCount = newLikeCount;
  // console.log(cuisineName,itemId)
  await db.query(`UPDATE "${cuisineName}" SET likes=likes+1 WHERE item_id=$1`,[itemId]);
  
  // console.log(req.body)
})
app.post('/:cuisine/:id/update-dislike',async (req,res)=>{
  try{
  // console.log(req.params.x);
  const cuisineName=req.params.cuisine;
  const itemId=req.params.id
  const {newLikeCount} = req.body;
  // const likeCount = newLikeCount;
  // console.log(cuisineName,itemId)
  await db.query(`UPDATE "${cuisineName}" SET likes=likes-1 WHERE item_id=$1`,[itemId]);
  }
  catch{
    res.send("No details found in Server")
  }
  // console.log(req.body)
})














const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

app.post("/:cuisine/:variety/submit", upload.single("recipeImage"),async (req,res)=>{
  // res.send("Submitted");
  // console.log("OK")
  // console.log(req)
  let userId=req.user.user_id;
  let cuisineName=req.params.cuisine;
  cuisineName=cuisineName.replaceAll(" ","_")
  // let file=req.body["recipeImage"];
  let file = req.file;
  const filePath = file.path;
  const fileContent = fs.readFileSync(filePath);
  // console.log(file);
  // console.log(typeof(fileContent.buffer)); 
  let varietyName=req.params.variety;
  let recipeTitle=req.body["recipeTitle"];
  let ingredients=req.body["ingredients"];
  let process=req.body["instructions"];
  
  const varietyResult=await db.query("SELECT variety_id FROM variety WHERE variety_name=$1",[varietyName]);
  const varietyId=varietyResult.rows[0].variety_id;

const lines = ingredients.split('\n');
ingredients = lines.map(line => {
    const match = line.match(/\d+\.\s+(.*)/);
    return match ? match[1] : '';
}).filter(ingredient => ingredient !== '');
// console.log(ingredients)
ingredients=JSON.stringify(ingredients);


const steps=process.split("\n");
process=steps.map(step=>{
  const check=step.match(/\d+\.\s+(.*)/);
  return check ? check[1] : ' ';
}).filter(step=> step!=' ');
// console.log(process)
process=JSON.stringify(process);
// console.log(ingredients);

// console.log(recipeImage)
// console.log(fileContent)
const updateResult=await db.query(`INSERT INTO "${cuisineName}" (variety_id,item_name,item_image,ingredients,process,user_id) VALUES ($1, $2, $3, $4,$5,$6)`,[varietyId,recipeTitle,fileContent,ingredients,process,userId]);
// console.log(updateResult)

// INSERT INTO "Indian_Cuisine" (variety_id,item_name,ingredients,process) VALUES (1,'Chicken','["grapes"]'::jsonb,'["youdo"]'::jsonb);
fs.unlinkSync(filePath);
// /:cuisine/:variety/addnew/

res.redirect(`/${cuisineName}/${varietyName}/addnew?success=true`);
});





app.post("/:cuisine/update", upload.single("recipeImage"),async (req,res)=>{
  // res.send("Submitted");
  // console.log("OK")
  const cuisineId=req.query.cuisine_id;
  const itemId=req.query.item_id;
  // console.log(req.query)
  let cuisineName=req.params.cuisine;
  cuisineName=cuisineName.replaceAll(" ","_")
  // let file=req.body["recipeImage"];
  // console.log(req.file)
  let file = req.file;
  // const filePath = file.path;
  // const fileContent = fs.readFileSync(filePath);
  // console.log(file);
  // console.log(typeof(fileContent.buffer)); 
  // let varietyName=req.params.variety;
  let recipeTitle=req.body["recipeTitle"];
  let ingredients=req.body["ingredients"];
  let process=req.body["instructions"];
  
  // const varietyResult=await db.query("SELECT variety_id FROM variety WHERE variety_name=$1",[varietyName]);
  // const varietyId=varietyResult.rows[0].variety_id;

const lines = ingredients.split('\n');
ingredients = lines.map(line => {
    const match = line.match(/\d+\.\s+(.*)/);
    return match ? match[1] : '';
}).filter(ingredient => ingredient !== '');
// console.log(ingredients)
ingredients=JSON.stringify(ingredients);
// console.log(ingredients)

const steps=process.split("\n");
process=steps.map(step=>{
  const check=step.match(/\d+\.\s+(.*)/);
  return check ? check[1] : ' ';
}).filter(step=> step!=' ');
// console.log(process)
process=JSON.stringify(process);
// console.log(ingredients);

// console.log(recipeImage)
// console.log(fileContent)
if(req.file){
  const filePath = file.path;
  const fileContent = fs.readFileSync(filePath);
const updateResult=await db.query(`UPDATE "${cuisineName}" SET item_name=$1, item_image=$2,ingredients=$3, process=$4 WHERE item_id=$5 AND cuisine_id=$6 `,[recipeTitle,fileContent,ingredients,process,itemId,cuisineId]);
fs.unlinkSync(filePath);
}
else{
  const updateResult=await db.query(`UPDATE "${cuisineName}" SET item_name=$1 ,ingredients=$2, process=$3 WHERE item_id=$4 AND cuisine_id=$5 `,[recipeTitle,ingredients,process,itemId,cuisineId]); 
}
// console.log(updateResult)

// INSERT INTO "Indian_Cuisine" (variety_id,item_name,ingredients,process) VALUES (1,'Chicken','["grapes"]'::jsonb,'["youdo"]'::jsonb);
// fs.unlinkSync(filePath);
// /:cuisine/:variety/addnew/
// console.log(req.user)
res.redirect("/myrecipe");
// client.release();
});
app.listen(port,()=>{
    console.log(`Successfully created port on ${port}`);
});