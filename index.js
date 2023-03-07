const express = require('express');
const mongodb = require('mongoose');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const cors = require ('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const ws = require('ws');
const dotenv = require('dotenv');
dotenv.config();

mongodb.connect(process.env.MONGO_URL);

const jwtSecret = process.env.JWT_SECRET;

const app = express();
app.use(cookieParser());
app.use(cors({
    credentials:true,
    origin:process.env.CLIENT_URL,
}));

app.use(express.json());


app.get('/test', (req, res) => {
    res.json('test ok');
});

app.get('/profile',(req,res)=>{
   const token =  req.cookies?.token;
   if(token){
   jwt.verify(token,jwtSecret,{},(err, userData)=>{
    if(err) throw err;
    res.json(
        userData
    );
   });
    }else{
        res.status(401).json('no token');
    }
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const createdUser = await User.create({ username, password });
    jwt.sign({ userId: createdUser._id, username}, jwtSecret, {},(err, token) => {
        if (err) throw err;
        res.cookie('token', token,{sameSite:'none',secure:true}).status(201).json({
            id: createdUser._id,
        });
    });
});

app.post('/login', async (req,res)=>{
    const{username, password}=req.body;
   const findUser = await User.findOne({username});
   if(findUser){
        const passOk = bcrypt.compare(password,findUser.password)
        if(passOk){
            jwt.sign({userId: findUser._id, username}, jwtSecret,{},(err,token)=>{
                res.cookie('token',token,{sameSite:'none',secure:true}).json({
                    id: findUser._id,
                });
            });
        }
    }
});

const server = app.listen(3999);

const wss = new ws.WebSocketServer({server});
wss.on('connection',(connection, req)=>{
   const cookies =req.headers.cookie;
   if (cookies){
    const tokenCookieString = cookies.split(';').find(str=>str.startsWith('token='));
    if (tokenCookieString){
        const token = tokenCookieString.split('=')[1];
        if (token){
            jwt.verify(token,jwtSecret,{},(err,userData)=>{
            
                if(err) throw err;
                const {userId, username} = userData;
                connection.userId = userId;
                connection.username = username;
            });
        }
    }
   }

   [...wss.clients].forEach(client=>{
        client.send(JSON.stringify({
            online:[...wss.clients].map(c=>({userId:c.userId,username:c.username})),
        }
            
        ));
   });
});