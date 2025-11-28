import app from "./app";
import './bot/telegramBot';
console.log('Starting server script...');

const PORT = process.env.PORT || 4000;

console.log(`Attempting to listen on port ${PORT}...`);

const server = app.listen(PORT, () => {
  console.log(`\n✅ SUCCESS: Server is running!`);
  console.log(`🚀 URL: ${process.env.BACKEND_URL}`);
  console.log(`👉 Health: ${process.env.BACKEND_URL}/health`);
});

// Catch "Port in use" errors
server.on('error', (err:any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ ERROR: Port ${PORT} is already in use. Try a different port in .env`);
  } else {
    console.error('❌ Server Error:', err);
  }
});