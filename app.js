const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
let db = null;
const dbPath = path.join(__dirname, "./covid19IndiaPortal.db");

const initializeServerAndDB = async () => {
  try {
    app.listen(3000, () => {
      console.log(`Server is running at http://localhost:3000/`);
    });

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeServerAndDB();

const userAuthentication = async (request, response, next) => {
  const { username, password } = request.body;
  const userQuery = `
  SELECT * FROM user WHERE username = '${username}';`;
  const user = await db.get(userQuery);
  if (user === undefined) {
    response.status(400);
    response.send(`Invalid user`);
  } else {
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (isPasswordMatched === true) {
      //   response.send(`welcome ${username}`);
      next();
    } else {
      response.status(400);
      response.send(`Invalid password`);
    }
  }
};

// token Authentication
const tokenAuthentication = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// Login API
app.post("/login/", userAuthentication, (request, response) => {
  const { username, password } = request.body;
  const payload = {
    username: username,
  };
  const jwtToken = jwt.sign(payload, "SECRET_KEY");
  response.send({ jwtToken });
});

// Get states
app.get("/states/", tokenAuthentication, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((state) => convertDbResponseObjToStateObj(state))
  );
});

const convertDbResponseObjToStateObj = (DbObject) => {
  return {
    stateId: DbObject.state_id,
    stateName: DbObject.state_name,
    population: DbObject.population,
  };
};

// get state
app.get("/states/:stateId/", tokenAuthentication, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
  SELECT * FROM state WHERE state_id = ${stateId};`;
  const stateDetails = await db.get(getStateQuery);
  const stateObj = convertDbResponseObjToStateObj(stateDetails);
  response.send(stateObj);
});

// add district
app.post("/districts/", tokenAuthentication, async (request, response) => {
  try {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    console.log(districtName);
    const addDistrictQuery = `
  INSERT INTO district 
  (district_name, state_id, cases, cured, active,  deaths)
  VALUES
  ('${districtName}', '${stateId}', '${cases}', '${cured}','${active}', '${deaths}');`;
    await db.run(addDistrictQuery);
    response.send(`District Successfully Added`);
  } catch (error) {
    console.log(`DB error: ${error.message}`);
  }
});

const convertDbResponseObjToDistrictObj = (DbObject) => {
  return {
    districtId: DbObject.district_id,
    districtName: DbObject.district_name,
    stateId: DbObject.state_id,
    cases: DbObject.cases,
    cured: DbObject.cured,
    active: DbObject.active,
    deaths: DbObject.deaths,
  };
};
// get district
app.get(
  "/districts/:districtId/",
  tokenAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT * FROM district WHERE district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    const districtObj = convertDbResponseObjToDistrictObj(district);
    response.send(districtObj);
  }
);

// delete district
app.delete(
  "/districts/:districtId/",
  tokenAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send(`District Removed`);
  }
);

// update district
app.put(
  "/districts/:districtId/",
  tokenAuthentication,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const {
        districtName,
        stateId,
        cases,
        cured,
        active,
        deaths,
      } = request.body;
      console.log(districtName);
      const updateDistrictQuery = `
  UPDATE district 
  SET district_name = '${districtName}',
  state_id = ${stateId},
  cases = ${cases},
  cured = ${cured},
  active = ${active},
  deaths = ${deaths}
  WHERE 
  district_id = ${districtId};`;
      await db.run(updateDistrictQuery);
      response.send(`District Details Updated`);
    } catch (error) {
      console.log(`DB error: ${error.message}`);
    }
  }
);

// get state stats
app.get(
  "/states/:stateId/stats",
  tokenAuthentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatesStatsQuery = `
    SELECT SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths FROM district
    WHERE state_id = ${stateId};`;
    const stateStats = await db.get(getStatesStatsQuery);
    response.send(stateStats);
  }
);

module.exports = app;
