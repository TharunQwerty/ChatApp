import {
  Button,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  VStack,
  useToast,
  Text,
  FormErrorMessage,
} from "@chakra-ui/react";
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ChatState } from "../../Context/ChatProvider";

const Signup = () => {
  const [show, setShow] = useState(false);
  const handleClick = () => setShow(!show);
  const toast = useToast();
  const navigate = useNavigate();
  const { setUser } = ChatState();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [confirmpassword, setConfirmpassword] = useState("");
  const [password, setPassword] = useState("");
  const [pic, setPic] = useState();
  const [picLoading, setPicLoading] = useState(false);
  
  // Validation states
  const [errors, setErrors] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmpassword: "",
  });

  // Validation functions
  const validateName = (value) => {
    if (!value || value.trim() === "") {
      return "Name cannot be empty";
    }
    if (value.length < 5) {
      return "Name must be at least 5 characters long";
    }
    if (/[^a-zA-Z0-9_\s]/.test(value)) {
      return "Name can only contain letters, numbers, and underscore";
    }
    if (value.endsWith("_")) {
      return "Name cannot end with an underscore";
    }
    return "";
  };

  const validateUsername = (value) => {
    if (!value || value.trim() === "") {
      return "Username cannot be empty";
    }
    if (value.length < 5) {
      return "Username must be at least 5 characters long";
    }
    if (/[^a-zA-Z0-9_]/.test(value)) {
      return "Username can only contain letters, numbers, and underscore";
    }
    if (value.endsWith("_")) {
      return "Username cannot end with an underscore";
    }
    return "";
  };

  const validateEmail = (value) => {
    if (!value || value.trim() === "") {
      return "Email cannot be empty";
    }
    if (!value.includes("@") || !value.includes(".")) {
      return "Email must contain @ and .";
    }
    return "";
  };

  const validatePassword = (value) => {
    if (!value) {
      return "Password is required";
    }
    if (value.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(value)) {
      return "Password must include at least one uppercase letter";
    }
    if (!/[a-z]/.test(value)) {
      return "Password must include at least one lowercase letter";
    }
    if (!/[0-9]/.test(value)) {
      return "Password must include at least one digit";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
      return "Password must include at least one special character";
    }
    return "";
  };

  const validateConfirmPassword = (value, password) => {
    if (value !== password) {
      return "Passwords do not match";
    }
    return "";
  };

  // Handle input changes with validation
  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    setErrors({...errors, name: validateName(value)});
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    setErrors({...errors, username: validateUsername(value)});
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setErrors({...errors, email: validateEmail(value)});
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    setErrors({
      ...errors, 
      password: validatePassword(value),
      confirmpassword: confirmpassword ? validateConfirmPassword(confirmpassword, value) : "",
    });
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmpassword(value);
    setErrors({...errors, confirmpassword: validateConfirmPassword(value, password)});
  };

  const submitHandler = async () => {
    setPicLoading(true);
    
    // Validate all fields
    const nameError = validateName(name);
    const usernameError = validateUsername(username);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(confirmpassword, password);
    
    // Update all error messages
    setErrors({
      name: nameError,
      username: usernameError,
      email: emailError,
      password: passwordError,
      confirmpassword: confirmPasswordError,
    });
    
    // Check if there are any validation errors
    if (nameError || usernameError || emailError || passwordError || confirmPasswordError) {
      toast({
        title: "Validation Error",
        description: "Please fix the form errors before submitting",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setPicLoading(false);
      return;
    }
    
    if (!name || !username || !email || !password || !confirmpassword) {
      toast({
        title: "Please Fill all the Fields",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setPicLoading(false);
      return;
    }
    
    console.log(name, username, email, password, pic);
    try {
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };
      const { data } = await axios.post(
        "/api/user",
        {
          name,
          username,
          email,
          password,
          pic,
        },
        config
      );
      console.log(data);
      toast({
        title: "Registration Successful",
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      localStorage.setItem("userInfo", JSON.stringify(data));
      setUser(data);
      setPicLoading(false);
      navigate("/chats");
    } catch (error) {
      toast({
        title: "Error Occurred!",
        description: error.response.data.message,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setPicLoading(false);
    }
  };

  const postDetails = (pics) => {
    setPicLoading(true);
    if (pics === undefined) {
      toast({
        title: "Please Select an Image!",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }
    console.log(pics);
    if (pics.type === "image/jpeg" || pics.type === "image/png") {
      const data = new FormData();
      data.append("file", pics);
      data.append("upload_preset", "chat-app");
      data.append("cloud_name", "piyushproj");
      fetch("https://api.cloudinary.com/v1_1/piyushproj/image/upload", {
        method: "post",
        body: data,
      })
        .then((res) => res.json())
        .then((data) => {
          setPic(data.url.toString());
          console.log(data.url.toString());
          setPicLoading(false);
        })
        .catch((err) => {
          console.log(err);
          setPicLoading(false);
        });
    } else {
      toast({
        title: "Please Select an Image!",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setPicLoading(false);
      return;
    }
  };

  return (
    <VStack spacing="5px">
      <FormControl id="first-name" isRequired isInvalid={errors.name}>
        <FormLabel>Name</FormLabel>
        <Input
          placeholder="Enter Your Name"
          value={name}
          onChange={handleNameChange}
        />
        <FormErrorMessage>{errors.name}</FormErrorMessage>
      </FormControl>
      
      <FormControl id="username" isRequired isInvalid={errors.username}>
        <FormLabel>Username</FormLabel>
        <Input
          placeholder="Enter Your Username"
          value={username}
          onChange={handleUsernameChange}
        />
        <FormErrorMessage>{errors.username}</FormErrorMessage>
      </FormControl>
      
      <FormControl id="email" isRequired isInvalid={errors.email}>
        <FormLabel>Email Address</FormLabel>
        <Input
          type="email"
          placeholder="Enter Your Email Address"
          value={email}
          onChange={handleEmailChange}
        />
        <FormErrorMessage>{errors.email}</FormErrorMessage>
      </FormControl>
      
      <FormControl id="password" isRequired isInvalid={errors.password}>
        <FormLabel>Password</FormLabel>
        <InputGroup size="md">
          <Input
            type={show ? "text" : "password"}
            placeholder="Enter Password"
            value={password}
            onChange={handlePasswordChange}
          />
          <InputRightElement width="4.5rem">
            <Button h="1.75rem" size="sm" onClick={handleClick}>
              {show ? "Hide" : "Show"}
            </Button>
          </InputRightElement>
        </InputGroup>
        <FormErrorMessage>{errors.password}</FormErrorMessage>
      </FormControl>
      
      <FormControl id="confirm-password" isRequired isInvalid={errors.confirmpassword}>
        <FormLabel>Confirm Password</FormLabel>
        <InputGroup size="md">
          <Input
            type={show ? "text" : "password"}
            placeholder="Confirm password"
            value={confirmpassword}
            onChange={handleConfirmPasswordChange}
          />
          <InputRightElement width="4.5rem">
            <Button h="1.75rem" size="sm" onClick={handleClick}>
              {show ? "Hide" : "Show"}
            </Button>
          </InputRightElement>
        </InputGroup>
        <FormErrorMessage>{errors.confirmpassword}</FormErrorMessage>
      </FormControl>
      
      <FormControl id="pic">
        <FormLabel>Upload your Picture</FormLabel>
        <Input
          type="file"
          p={1.5}
          accept="image/*"
          onChange={(e) => postDetails(e.target.files[0])}
        />
      </FormControl>
      
      <Button
        colorScheme="blue"
        width="100%"
        style={{ marginTop: 15 }}
        onClick={submitHandler}
        isLoading={picLoading}
      >
        Sign Up
      </Button>
    </VStack>
  );
};

export default Signup;
