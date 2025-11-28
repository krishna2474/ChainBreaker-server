import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// IMPORTANT: No .js extensions in TypeScript!
import healthRoutes from "./routes/health";
import factCheckRoutes from "./routes/factCheckRoutes";

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/health", healthRoutes);
app.use("/api/factCheck", factCheckRoutes);

export default app;
