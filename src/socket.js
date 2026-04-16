const { Server } = require("socket.io");

let io;
// Initialize with random numbers upon server start based on requirements:
// minimum 2k users, minimum 50k paid today.
let fakeActiveUsers = 2000 + Math.floor(Math.random() * 800); // 2000 to 2800
let fakePaidToday = 50000 + Math.floor(Math.random() * 90000); // 50k to 140k

const NAMES = [
    "Aarav", "Vivaan", "Aditya", "Arjun", "Reyansh", "Mohit", "Rohit", "Rahul", "Karan", "Vikas",
    "Sandeep", "Amit", "Ankit", "Manish", "Deepak", "Saurabh", "Nitin", "Gaurav", "Harsh", "Yash",
    "Abhishek", "Akash", "Shubham", "Ayush", "Rajat", "Varun", "Naveen", "Pankaj", "Tarun", "Ravi",
    "Dinesh", "Mukesh", "Sanjay", "Ajay", "Vijay", "Sunil", "Anil", "Pradeep", "Rakesh", "Naresh",
    "Kapil", "Arvind", "Siddharth", "Kabir", "Ishaan", "Dev", "Lakshya", "Kunal", "Parth", "Tushar",
    "Nikhil", "Chirag", "Himanshu", "Mayank", "Ashish", "Umesh", "Lokesh", "Mahesh", "Rajesh", "Jitendra",
    "Priya", "Neha", "Pooja", "Anjali", "Sneha", "Kavita", "Riya", "Meera", "Sonia", "Swati",
    "Aarti", "Nisha", "Shreya", "Divya", "Pallavi", "Komal", "Payal", "Rashmi", "Simran", "Preeti",
    "Tanvi", "Isha", "Kriti", "Muskan", "Sakshi", "Alka", "Seema", "Rekha", "Jyoti", "Mamta",
    "Bhavna", "Renu", "Kiran", "Anu", "Sarita", "Geeta", "Sunita", "Lata", "Nandini", "Vaishali"
];

const ACTIONS = ["earned ₹50 with refer", "earned ₹200 signup bonus", "withdrew ₹500", "earned ₹50 with refer"];

let recentEvents = [];

const generateFakeEvent = () => {
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    return { name, action, time: "Just now", type: "fake" };
};

const pushEvent = (event) => {
    recentEvents.unshift(event);
    if (recentEvents.length > 20) recentEvents.pop();
    if (io) io.emit("live-feed", event);
};

const initSocket = (server) => {
    io = new Server(server, {
        cors: { origin: "*" }
    });

    // Update stats randomly
    setInterval(() => {
        fakeActiveUsers += Math.floor(Math.random() * 21) - 10;
        if (fakeActiveUsers < 2000) fakeActiveUsers = 2000;
        if (fakeActiveUsers > 2500) fakeActiveUsers = 2500;

        io.emit("live-stats", {
            activeUsers: `${(fakeActiveUsers / 1000).toFixed(1)}k+`,
            paidToday: `₹${(fakePaidToday / 100000).toFixed(1)}L+`
        });
    }, 5000);

    // Gently increase total paid
    setInterval(() => {
        fakePaidToday += Math.floor(Math.random() * 300) + 50;
    }, 15000);

    // Broadcast feed every ~4-7 seconds
    setInterval(() => {
        pushEvent(generateFakeEvent());
    }, 6000);

    io.on("connection", (socket) => {
        socket.emit("live-stats", {
            activeUsers: `${(fakeActiveUsers / 1000).toFixed(1)}k+`,
            paidToday: `₹${(fakePaidToday / 100000).toFixed(1)}L+`
        });
        socket.emit("initial-feed", recentEvents);
    });

    return io;
};

const broadcastRealEvent = (name, action) => {
    pushEvent({ name, action, time: "Just now", type: "real" });
};

module.exports = { initSocket, broadcastRealEvent };
