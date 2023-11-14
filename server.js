const express=require('express')
const mysql=require('mysql2')
const app=express()
const axios=require('axios')
const cors=require('cors')
const bodyparser = require("body-parser")

// app.use(bodyparser.urlencoded({extended:true}))
app.use(bodyparser.json())
app.use(cors())
// app.use(express.json())

// create database
const database=mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password:'123456789',
})

database.connect((err)=>{
    if (err) throw err
    console.log('Connected')
})

database.query('CREATE DATABASE IF NOT EXISTS roxiler;',(err,result)=>{
    if(err) throw err
    console.log("Database Connected")
})

app.get("/getjson",async (req,res)=>{
    const api_url='https://s3.amazonaws.com/roxiler.com/product_transaction.json'
    const response = await axios.get(api_url)
    const data= response.data
    // console.log(data)
    database.query('create table if not exists roxiler.salesData(id int PRIMARY KEY,title VARCHAR(255) NOT NULL,price decimal(7,2) NOT NULL,description VARCHAR(1000) NOT NULL,category VARCHAR(100) NOT NULL,image VARCHAR(255),sold BIT(1) NOT NULL, dateOfSale datetime)', (err, result)=>{
        if (err){throw err}
        console.log("table created");
    })
    data.forEach(item => {
        let time = item.dateOfSale.replace("T"," ").slice(0,3)
        database.query(`insert IGNORE into roxiler.salesData(id,title,price,description,category,image,sold,dateOfSale) values(?,?,?,?,?,?,?,?)`,[item.id,item.title,item.price,item.description,item.category,item.image,item.sold,item.dateOfSale],(err,results)=>{
            if(err)throw err
            console.log("quary seccessfull",item.dateOfSale)
        })
        database.query(`update roxiler.salesdata set dateOfSale = date_add(?, INTERVAL 330 MINUTE) where id = ?;`,[item.dateOfSale,item.id],(err,results)=>{
            if(err)throw err
            console.log("UPDATE seccessfull")
        })
    });
    res.status(200).json({"msg":"successful"})
})

app.get("/Statistics",(req,res)=>{
    // console.log(req.body);
    let month = "05";
    database.query(`select sum(price) sum,count(id) count, sold from roxiler.salesdata where dateOfSale like ? group by sold;`,"_____"+month+"%",(err,result)=>{
        const jsonobj = {}
        result.forEach(item=>{
            if(item.sold.toString('hex')==0)
            {
                jsonobj["notSoldItems"] = item.count
            }
            else if(item.sold.toString('hex')==1)
            {
                jsonobj["SoldItems"] = item.count;
                jsonobj["SoldPrice"] = item.sum;
            }
        })
        // console.log(result,jsonobj);
        res.status(200).json(jsonobj)
    })
})
 
app.get("/barchart",(req,res)=>{
    const quary_sting = "SELECT count(id) count, pricegroup from (SELECT *, CASE WHEN price BETWEEN 0 AND 100 THEN '0 - 100' WHEN price BETWEEN 101 AND 200 THEN '101 - 200' WHEN price BETWEEN 201 AND 300 THEN '201 - 300' WHEN price BETWEEN 301 AND 400 THEN '301 - 400' WHEN price BETWEEN 401 AND 500 THEN '401-500' WHEN price BETWEEN 501 AND 600 THEN '501-600' WHEN price BETWEEN 601 AND 700 THEN '601-700' WHEN price BETWEEN 701 AND 800 THEN '701-800' WHEN price BETWEEN 801 AND 900 THEN '801-900' ELSE '900 Above' END pricegroup FROM roxiler.salesdata where dateOfSale like ? ) as newdata group by newdata.pricegroup;"
    const month = "05"
    const jsonobj = []
    database.query(quary_sting,"_____"+month+"%",(err,result)=>{
        // console.log(result);
        res.status(200).json(result);
    })
})
app.get("/piechart", (req,res)=>{
    const month = "05"
    database.query("select count(category) count, category from roxiler.salesdata where dateOfSale like ? group by category;","_____"+month+"%",(err,result)=>{
        // console.log(result);
        res.status(200).json(result);
    })
})
app.post("/search", (req,res)=>{
    const {search}= req.body
    console.log(search,req.body);
    const month = ""
    // const search = ""
    const page = 1
    const starting_index = (page-1)*10
    database.query("select * from roxiler.salesdata where dateOfSale like ? and (lower(title) like lower(?) or lower(description) like lower(?) or lower(price) like lower(?)) limit 10 offset ?;",["_____"+month+"%","%"+search+"%","%"+search+"%","%"+search+"%",starting_index],(err,result)=>{
        res.status(200).json(result)
    })
})
app.get("/combinedinfo",async (req,res)=>{
    const data1 = await fetch("http://localhost:3005/piechart").then(info=>info.json()).then(dt=>{console.log(dt);
    // res.status(200).json(dt)
    return dt
    });
    const data2 = await fetch("http://localhost:3005/barchart").then(info=>info.json()).then(dt=>{console.log(dt);
    // res.status(200).json(dt)
    return dt
    });
    const data3 = await fetch("http://localhost:3005/Statistics").then(info=>info.json()).then(dt=>{console.log(dt);
    // res.status(200).json(dt)
    return dt
    });
    res.status(200).json([data1,data2,data3])
})

app.listen(3005,()=>console.log("Server is Running..."))