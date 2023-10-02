const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

let db = null;

const initializeDbServerToRespond = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running At http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB ERROR : ${e.message}`);
  }
};

initializeDbServerToRespond();

function authenticateJwtToken(request, response, next) {
  let jwtToken;

  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    respond.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "om", async (error, payload) => {
      if (error) {
        response.status(401);
        respond.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.userId = payload.userId;
        next();
      }
    });
  }
}

const validatePassword = (password) => {
  return password.length > 5;
};
//API-1

app.post("/register/", authenticateJwtToken, async (request, response) => {
  const { username, password, name, gender } = request.body;

  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const hashedPassword = await bcrypt.hash(password, 10);
  if (dbUser === undefined) {
    if (validatePassword(password)) {
      const createNewUserQuery = `INSERT INTO user(username,password,name,gender)
        VALUES(
            '${username}',
            '${hashedPassword}',
            '${name}',
           '${gender}');`;

      const response = await db.run(createNewUserQuery);
      response.status = 200;
      response.send("User created successfully");
    } else {
      response.status = 400;
      response.send("Password is too short");
    }
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

//API-2

app.post("/login/", authenticateJwtToken, async (request, response) => {
  const { username, password } = request.body;

  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status = 400;
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "om");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API-3

app.get(
  "/user/tweets/feed/",
  authenticateJwtToken,
  async (request, response) => {
    const { userId } = request;

    const getUserTweetsQuery = `SELECT user.username,tweet.tweet,tweet.date_time as dateTime
    FROM tweet 
    INNER JOIN user ON tweet.user_id = user.user_id
    WHERE tweet.user_id IN (
        SELECT following_user_id 
        FROM follower
        WHERE follower_user_id = ${userId}
    )
    ORDER BY dateTime DESC
    LIMIT 4;`;
    const data = await db.all(getUserTweetsQuery);
    response.send(data);
  }
);

//API-4

app.get("/user/following/", authenticateJwtToken, async (request, response) => {
  const getUserQuery = `SELECT user.name 
  FROM user 
  INNER JOIN follower ON user.user_id = follower.following_user_id
  WHERE follower.follower_user_id = ${userId};`;

  const data = await db.all(getUserQuery);
  response.send(data);
});

//API-5

app.get("/user/following/", authenticateJwtToken, async (request, response) => {
  const getUserQuery = `SELECT user.name 
  FROM user 
  NATURAL JOIN follower ON user.user_id = follower.following_user_id;`;

  const data = await db.all(getUserQuery);
  response.send(data);
});

//API-6

app.get(
  "/tweets/:tweetId/",
  authenticateJwtToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const selectTweetsQuery = `
    SELECT tweet,
    (SELECT COUNT(*) FROM like WHERE tweet_id = '${tweetId}') AS likes,
    (SELECT COUNT(*) FROM reply WHERE tweet_id = '${tweetId}') AS replies,
    date_time as dateTime 
    FROM tweet 
    WHERE tweet_id = ${tweetId};`;

    const data = await db.all(selectTweetsQuery);

    response.send(data);
  }
);

//API-7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateJwtToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getTweetsQuery = `
      SELECT
       count(*) AS likes
       FROM like
       WHERE user_id = '${user_id}';`;

    const data = await db.all(getTweetsQuery);
    const user = data.map((each) => each.username);
    response.send({ likes: user });
  }
);

//API-8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateJwtToken,
  async (request, respond) => {
    const { tweetId } = request.params;

    const getReplyQuery = `SELECT user.name,reply 
    FROM user 
    INNER JOIN reply ON user.user_id = reply.user_id 
     WHERE reply.tweet_id  = ${tweetId};`;

    const data = await db.all(getReplyQuery);
    response.send({ replies: data });
  }
);

//API-9

app.get("/user/tweets/", authenticateJwtToken, async (request, respond) => {
  const { userId } = request;

  const getUserTweets = `
    SELECT tweet.tweet,
    (SELECT COUNT(*) FROM like WHERE like.tweet_id = tweet.tweet_id) AS likes,
    (SELECT COUNT(*) FROM reply WHERE reply.tweet_id = tweet.tweet_id) AS replies
    FROM tweet
    WHERE tweet.user_id = ${userId};`;

  const data = await db.all(getUserTweets);
  response.send(data);
});

//API-10

app.post("/user/tweets/", async (request, respond) => {
  const { userId } = request;
  const { tweet } = request.body;
  const tweetQuery = `INSERT INTO tweet(tweet)
    VALUES('${tweet}')
    WHERE tweet.user_id = ${userId};`;

  await db.run(tweetQuery);

  respond.send("Created a tweet");
});

//API-11

app.delete(
  "/tweets/:tweetId/",
  authenticateJwtToken,
  async (request, response) => {
    const { tweetId } = request.params;

    const deleteTweetQuery = `DELETE * FROM tweet WHERE tweet_id = ${tweetId};`;
    await db.run(deleteTweetQuery);

    response.send("Tweet Removed");
  }
);

module.exports = app;
