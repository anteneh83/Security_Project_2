const connect = require('./config/db');
const User = require('./models/User');
const bcrypt = require('bcrypt');

async function run() {
  // Use actual MongoDB URI directly
  const MONGO_URI = 'mongodb+srv://certigenai:Anti7452@cluster0.2slssbc.mongodb.net/paper_submission?retryWrites=true&w=majority&appName=Cluster0';
  
  await connect(MONGO_URI);

  const pw = await bcrypt.hash('12345678', 10);

  const existing = await User.findOne({ email: 'antenehgetnet@gmail.com' });
  if (!existing) {
    await User.create({
      name: 'Administrator',
      email: 'antenehgetnet@gmail.com',
      passwordHash: pw,
      role: 'superadmin',
      accountStatus: 'active',
      clearanceLevel: 3,
      department: 'Administration'
    });
    console.log('Admin user created: antenehgetnet@gmail.com / 12345678');
  } else {
    console.log('Admin already exists.');
  }
  
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
