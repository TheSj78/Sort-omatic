var express = require('express');
const session = require('express-session');
var app = express();
const bodyParser = require('body-parser');

const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

const serviceAccount = require('./ecohacks-522fa-firebase-adminsdk-uyybj-4790e5d5ec.json');

initializeApp({
  credential: cert(serviceAccount)
});

app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const db = getFirestore();

app.use(express.static(__dirname + '/assets'));
app.set('view engine', 'ejs');

app.get(['/', '/home'], function (req, res) {
    res.render('home');
});

app.get('/about-us', function (req, res) {
    res.render('about');
});

app.get('/contact-us', function(req, res) {
    res.render('contact', {sent: req.session.sentSuccessfully});
});

app.get('/login', function(req, res) {
    res.render('login', {incorrect: req.session.incorrectData});
});

app.get('/register', function(req, res) {
    res.render('register', {incorrect: req.session.tryagain_register});
});

app.post('/create', async function(req, res) {
    var BreakException = {};

    let email = req.body.email;
    let uname = req.body.username;
    let password = req.body.password;

    const users = await db.collection('sample_accounts').get();
    try {
        users.forEach((doc) => {
            if (uname === doc.data().username || email === doc.data().email_id)
            {
                req.session.tryagain_register = true;
                throw BreakException;
            }
        })
    } catch (e) {
        if (e !== BreakException) throw e;
    }

    if (req.session.tryagain_register)
    {
        res.redirect('/register');
    }
    else
    {
        const newDoc = await db.collection('sample_accounts').add({
            email_id: email,
            username: uname,
            password: password,
            compost_count: 0,
            trash_count: 0,
            recycle_count: 0,
            points: 0
        });
        
        console.log('Added document with ID: ', newDoc.id);

        res.redirect('/login')
    }
  
});

app.post('/authorize', async function(req, res) {
    var BreakException = {};

    let username = req.body.username;
	let password = req.body.password;
    console.log('Entered username: ' + username);
    console.log('Entered password: ' + password);

    const users = await db.collection('sample_accounts').get();
    try {
        users.forEach((doc) => {
            if (username === doc.data().username && password === doc.data().password)
            {
                req.session.loggedIn = true;
                req.session.username = username;
                req.session.data = doc.data();
                throw BreakException;
            }
        })
    } catch (e) {
        if (e !== BreakException) throw e;
    }

    if (req.session.loggedIn)
    {
        req.session.incorrectData = false;
        res.redirect('/stats');
    }
    else
    {
        req.session.incorrectData = true;
        res.redirect('/login')
    }
});

app.get('/stats', async function(req, res) {
    if (!req.session.loggedIn)
    {
        res.redirect('login');
    }
    else
    {
        var rank_list = [];

        updateFunction(req);

        const snapshot2 = await db.collection('sample_accounts').orderBy("points", "desc").limit(10).get();
        snapshot2.forEach((doc) => {
            rank_list.push(doc.data());
        });

        let trash_count = req.session.data.trash_count;
        let sum_count = req.session.data.compost_count + req.session.data.recycle_count;

        let s1 = trash_count < 10 ? 
            `You've sorted ${trash_count} items of trash, but we are sure you can do much more!` : 
            `You've sorted ${trash_count} objects into trash! That's a lot more than what most people do!`;
        let s2 = sum_count < 40 ? 
            `You've sorted ${sum_count} items into compost and recylable! But you know that you can do better! ` :
            `You've sorted ${sum_count} items into compost and recylable! Way to go on helping saving the environment!`;

        res.render('stats', {data: req.session.data, ranks: rank_list, sentence1: s1, sentence2: s2, acc_username: req.session.username});
    }
});

app.get('/logout', function(req, res) {
    req.session.destroy();
    res.redirect('/home');
});

app.post('/reachout', async function(req, res) {
    let email = req.body.email;
    let name = req.body.name;
    let message = req.body.subject;

    await db.collection('contacts').add({
        email_id: email,
        name: name,
        message: message,
    });

    req.session.sentSuccessfully = true;

    res.redirect('/contact-us')
});

const updateFunction = async function(req) {
    var BreakException = {};
    const snapshot = await db.collection('sample_accounts').get();
    try {
        snapshot.forEach((doc) => {
            if (req.session.username && req.session.username === doc.data().username)
            {
                req.session.data = doc.data();
                throw BreakException;
            }
        });
    } catch (e) {
        if (e !== BreakException) throw e;
    }
}

app.listen(5000);