import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { bookSlot } from "./booking.controller.js";

const router = Router();

router.use(authenticate);
router.post("/", authorize("PATIENT"), bookSlot);

export default router;