const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const generateToken = require("../config/generateToken");

//@description     Get or Search all users
//@route           GET /api/user?search=
//@access          Public
const allUsers = asyncHandler(async (req, res) => {
  const keyword = req.query.search
    ? {
        $or: [
          { name: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
          { username: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};

  const users = await User.find(keyword).find({ _id: { $ne: req.user._id } });
  res.send(users);
});

//@description     Validate user input for registration
const validateUserInput = (name, username, email, password) => {
  const errors = {};
  
  // Validate name
  if (!name || name.trim() === "") {
    errors.name = "Name cannot be empty";
  } else if (name.length < 5) {
    errors.name = "Name must be at least 5 characters long";
  } else if (/[^a-zA-Z0-9_\s]/.test(name)) {
    errors.name = "Name can only contain letters, numbers, and underscore";
  } else if (name.endsWith("_")) {
    errors.name = "Name cannot end with an underscore";
  }
  
  // Validate username
  if (!username || username.trim() === "") {
    errors.username = "Username cannot be empty";
  } else if (username.length < 5) {
    errors.username = "Username must be at least 5 characters long";
  } else if (/[^a-zA-Z0-9_]/.test(username)) {
    errors.username = "Username can only contain letters, numbers, and underscore";
  } else if (username.endsWith("_")) {
    errors.username = "Username cannot end with an underscore";
  }
  
  // Validate email
  if (!email || email.trim() === "") {
    errors.email = "Email cannot be empty";
  } else if (!email.includes("@") || !email.includes(".")) {
    errors.email = "Email must contain @ and .";
  }
  
  // Validate password
  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters long";
  } else if (!/[A-Z]/.test(password)) {
    errors.password = "Password must include at least one uppercase letter";
  } else if (!/[a-z]/.test(password)) {
    errors.password = "Password must include at least one lowercase letter";
  } else if (!/[0-9]/.test(password)) {
    errors.password = "Password must include at least one digit";
  } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.password = "Password must include at least one special character";
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

//@description     Register new user
//@route           POST /api/user/
//@access          Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, pic, username } = req.body;

  // Validate all input fields
  const validation = validateUserInput(name, username, email, password);
  
  if (!validation.isValid) {
    res.status(400);
    throw new Error(Object.values(validation.errors)[0]); // Return the first error
  }

  const userExists = await User.findOne({ $or: [{ email }, { username }] });

  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  const user = await User.create({
    name,
    username,
    email,
    password,
    pic,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      pic: user.pic,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("User not found");
  }
});

//@description     Auth the user
//@route           POST /api/users/login
//@access          Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      pic: user.pic,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid Email or Password");
  }
});

module.exports = { allUsers, registerUser, authUser };
