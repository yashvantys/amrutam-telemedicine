import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
    startConsultation,
    completeConsultation,
} from "./consultation.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorize("DOCTOR"));

router.post("/:id/start", startConsultation);
router.post("/:id/complete", completeConsultation);

export default router;