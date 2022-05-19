const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const res = require('express/lib/response');
require('dotenv').config();
const port = process.env.PORT || 5000;

// middletier
app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hvyjl.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized access' })
  }
  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      res.status(403).send({ message: 'forbidden access' })
    }
    req.decoded = decoded;
    next();
  })
}

async function run() {
  try {
    await client.connect();

    const servicesCollection = client.db('doctors_portal').collection('services');
    const bookingCollection = client.db('doctors_portal').collection('bookings');
    const userCollection = client.db('doctors_portal').collection('users');
    const doctorCollection = client.db('doctors_portal').collection('doctors');

    const verifyAdmin = async (req, res, next) =>{
      const initiater = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: initiater });
      if (requesterAccount.role === 'admin') { 
        next()
      }
      else {
        res.status(403).send({ message: 'Forbidden Access' })
      }
    }

    /**
     * --------------------------
     * Api naming Convention
     * --------------------------
     * app.get('/booking') // get all bookings in this collections, or by query, or by filter one by one
     * app.get('/booking/:id') // get a specific booking
     * app.post('/booking') // add a new booking
     * app.patch('/booking/:id') // update a specific booking
     * app.put('/booking/:id) // upsert ==> update (if exists) or insert (if dosen't exist)
     * app.delete('/booking/:id') // delete a specific booking
     */

    app.get('/services', async (req, res) => {
      const query = {}
      const cursor = servicesCollection.find(query).project({ name: 1 })
      const services = await cursor.toArray()
      res.send(services)
    })



    app.get('/booking', verifyJWT, async (req, res) => {
      const patientEmail = req.query.patientEmail;
      const decodedEmail = req?.decoded?.email;
      if (patientEmail === decodedEmail) {
        const query = { patientEmail: patientEmail }
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings)
      }
      else {
        res.status(403).send({ message: 'forbidden access' })
      }
    })

    app.get('/booking/:id', verifyJWT, async (req, res) => { 
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const booking = await bookingCollection.findOne(query)
      res.send(booking);
    })
    
    // Warning: This is not the proper way to query multiple collection. 
    // After learning more about mongodb. use aggregate, lookup, pipeline, match, group
    app.get('/available', async (req, res) => {
      const date = req.query.date;

      // step 1:  get all services
      const services = await servicesCollection.find().toArray();

      // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();

      // step 3: for each service
      services.forEach(service => {
        // step 4: find bookings for that service. output: [{}, {}, {}, {}]
        const serviceBookings = bookings.filter(book => book.treatment === service.name);
        // step 5: select slots for the service Bookings: ['', '', '', '']
        const bookedSlots = serviceBookings.map(book => book.slot);
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(slot => !bookedSlots.includes(slot));
        //step 7: set available to slots to make it easier 
        service.slots = available;
      });

      res.send(services);

    })



    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const filter = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
      const exists = await bookingCollection.findOne(filter);
      if (exists) {
        return res.send({ success: false, booking: exists })
      }
      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, result })
    })

    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray()
      res.send(users)
    });

    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin })
    })

    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
        const filter = { email: email };
        const updatedDoc = {
          $set: { role: 'admin' }
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
    });


    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = req.body;
      const options = { upsert: true };
      const updatedDoc = {
        $set: user
      };
      const result = await userCollection.updateOne(filter, updatedDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' })
      res.send({ result, token });
    });


    app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors)
    });

    app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await doctorCollection.deleteOne(query)
      res.send(result)
    })

    app.post('/doctor',verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    })

  }
  finally {
    // await client.close();
    // hehe
  }
}
run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('Doctor on Fire')
})

app.listen(port, () => {
  console.log(`Doctor is in Port:`, port)
})