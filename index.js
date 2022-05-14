const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

// middletier
app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hvyjl.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
  try {
    await client.connect();

    const servicesCollection = client.db('doctors_portal').collection('services');
    const bookingCollection = client.db('doctors_portal').collection('bookings');



    app.get('/services', async (req, res) => {
      const query = {}
      const cursor = servicesCollection.find(query)
      const services = await cursor.toArray()
      res.send(services)
    })

    app.get('/booking', async (req, res) => {
      const patientEmail = req.query.patientEmail
      const query = { patientEmail: patientEmail }
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings)
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

    /**
     * --------------------------
     * Api naming Convention
     * --------------------------
     * app.get('/booking') // get all bookings in this collections, or by query, or by filter one by one
     * app.get('/booking/:id') // get a specific booking
     * app.post('/booking') // add a new booking
     * app.patch('/booking/:id') // update a specific booking
     * app.delete('/booking/:id') // delete a specific booking
     */

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


  }
  finally {
    // await client.close();
  }
}
run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('Doctor on Fire')
})

app.listen(port, () => {
  console.log(`Doctor is in Port:`, port)
})