
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { createSlot, listSlots } from "./availability.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", listSlots);

router.post(
    "/doctors/:doctorId/slots",
    authorize("DOCTOR"),
    createSlot,
);

export default router;
