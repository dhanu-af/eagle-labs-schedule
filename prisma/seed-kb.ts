import { PrismaClient, KbCategory } from "../src/generated/prisma";

const prisma = new PrismaClient();

type Entry = {
  category: KbCategory;
  title: string;
  keywords: string;
  cause?: string;
  answer: string;
  source: string;
  order: number;
};

const entries: Entry[] = [
  // ───────────────────────────── BLENDING SOP ─────────────────────────────
  {
    category: "BLENDING_SOP",
    title: "PPE and hygiene before entering the blending room",
    keywords: "ppe, hygiene, gloves, hairnet, lab coat, shoe covers, beard mask, hand washing, gowning, gowning order",
    answer:
      "Wash your hands thoroughly before entering the blending room. Put on PPE in this order: beard mask (if applicable), hair net, lab coat, shoe covers, then sanitized gloves. All PPE must be clean, properly fitted, and sanitized before use.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Step 1",
    order: 1,
  },
  {
    category: "BLENDING_SOP",
    title: "Room and equipment check before starting a blend",
    keywords: "room check, equipment check, blender clean, scoops, sieves, cleaning label, cleaning logbook, pre-operation check",
    answer:
      "Verify the blending room is clean and ready. Check that the blender, scoops, and sieves are clean, intact, and in good condition. Confirm the previous cleaning label is completed and displayed, and review the cleaning logbook to confirm cleaning was documented and approved. Make sure there is no residual material, dust, or foreign matter in the area.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Step 2",
    order: 2,
  },
  {
    category: "BLENDING_SOP",
    title: "Document verification and requesting raw materials",
    keywords: "batch record, material list, document verification, warehouse request, raw material request",
    answer:
      "Review all production documents (batch record, material list) for accuracy and completeness, and confirm they are approved, signed, and up to date. Submit the verified documents to the warehouse to request raw materials, and confirm the materials issued match the batch requirements and specifications.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Step 3",
    order: 3,
  },
  {
    category: "BLENDING_SOP",
    title: "Cleaning, sanitizing, and drying equipment before use",
    keywords: "cleaning blender, sanitize equipment, drying, scoops sieves scales buckets, residual moisture",
    answer:
      "Clean and sanitize the blender per the approved cleaning procedure, along with all tools used (scoops, sieves, scales, buckets, ladders, discharge buckets, accessories). Dry everything thoroughly before use to prevent contamination, and verify there is no residual moisture, cleaning agent, or foreign material left behind.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Step 4",
    order: 4,
  },
  {
    category: "BLENDING_SOP",
    title: "Receiving and verifying raw materials from the warehouse",
    keywords: "raw material receiving, released status, QA release sticker, labeling, packaging integrity, material changing bay",
    answer:
      "Place materials received from the warehouse in the material changing bay. Verify each material against the batch documentation and material list, checking correct labeling, a valid QA 'Released' status sticker, and undamaged packaging. Only use approved and released materials, and segregate/clearly identify them to prevent mix-ups. Record all checks in the batch record.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Step 6",
    order: 5,
  },
  {
    category: "BLENDING_SOP",
    title: "Environmental checks and supervisor approval before dispensing",
    keywords: "temperature RH check, environmental conditions, supervisor approval, sign off before production",
    answer:
      "Record temperature and relative humidity and confirm they are within acceptable limits — report anything out of specification to the supervisor immediately. Submit all completed documents and checks to the supervisor for review and obtain formal approval before starting dispensing. Do not commence production without authorization.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Steps 7-8",
    order: 6,
  },
  {
    category: "BLENDING_SOP",
    title: "Dispensing materials with second-person verification",
    keywords: "dispensing tags, weighing, double check verification, material identity, quantity accuracy, dispensing pallet",
    answer:
      "Prepare dispensing tags with material name, batch number, required quantity, date, and operator details. Transfer raw materials one at a time into the dispensing room and weigh/dispense per the batch record. A second person must verify material identity and weight/quantity accuracy. Place dispensed materials on the designated pallet with the correct tag attached, and record all details in the batch documentation.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Steps 9-11",
    order: 7,
  },
  {
    category: "BLENDING_SOP",
    title: "In-process inspection and sieving during dispensing",
    keywords: "sieving, lumps, clumping, foreign particles, gloves sieving, contamination control",
    answer:
      "While dispensing, visually inspect all materials for quality issues, clumping, foreign particles, or abnormalities. If required, sieve ingredients per the approved procedure to ensure uniformity and remove agglomerates. Always wear gloves when sieving and never handle materials with bare hands. Put used scoops/utensils into the designated container for cleaning.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Step 13",
    order: 8,
  },
  {
    category: "BLENDING_SOP",
    title: "Pre-mixing blender check and starting the mix",
    keywords: "mixing time, blender check, BMR mixing parameters, order of ingredient addition, start mixing",
    answer:
      "Before mixing, verify the blender is in proper working condition, the discharge ON/OFF function works, and the blender is clean and completely dry. Check the mixing instructions against the Batch Manufacturing Record (BMR) for mixing time and ingredient addition order. Load the dispensed ingredients, close and lock the blender lid, and start mixing per the approved parameters. Monitor for consistent mixing. Place a 'No Entry' sign on the door, remove PPE in the correct order, and wash hands.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Steps 15-17",
    order: 9,
  },
  {
    category: "BLENDING_SOP",
    title: "When and how to add magnesium mid-blend",
    keywords: "magnesium addition, 20 minutes, mid process addition, re-enter blending room, lubricant addition",
    answer:
      "After 20 minutes of initial mixing, re-enter the blending room following full hygiene/PPE requirements. Make sure the blender has completely stopped and is safe to open before adding anything. Add magnesium exactly as specified in the Batch Manufacturing Record (BMR), double-checking material identity and quantity. Close the lid securely and restart blending for the remaining specified time.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Step 'Mid-Process Addition'",
    order: 10,
  },
  {
    category: "BLENDING_SOP",
    title: "Blend uniformity check before discharge",
    keywords: "blend uniformity, powder consistency check, blend not uniform, supervisor approval discharge",
    answer:
      "After the blender stops, re-enter following full hygiene/PPE requirements and confirm the blender is fully stopped before opening the lid. Check the powder uniformity visually (or per procedure). If the blend is not uniform, inform the supervisor and re-evaluate before proceeding — do not discharge an out-of-spec blend. Once uniformity is confirmed, obtain supervisor approval to begin discharge.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Steps 20-21",
    order: 11,
  },
  {
    category: "BLENDING_SOP",
    title: "Controlled powder discharge, drum filling, and labelling",
    keywords: "powder discharge, drum filling, weighing drum, in-process label, silica desiccant, spillage",
    answer:
      "Line each drum with a clean plastic bag and add silica desiccant if required. Start the discharge slowly to avoid spillage and dust. Once a drum is filled, stop the discharge, weigh it on a calibrated scale, record the weight in the BMR, and attach the correct In-Process label. Continue until all powder is discharged and check the blender for residual powder.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Steps 23-26",
    order: 12,
  },
  {
    category: "BLENDING_SOP",
    title: "Sampling drums and in-process QA testing",
    keywords: "sampling, 50g sample, sample bag, QA retention label, powder density, moisture content",
    answer:
      "Collect approximately 50g samples from each drum, seal them in sample bags with clip ties, and attach QA retention/sample labels. Secure the drum lids after sampling. Perform required in-process checks such as powder density and moisture content and record results.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Steps 27-28",
    order: 13,
  },
  {
    category: "BLENDING_SOP",
    title: "Final documentation, QA submission, and warehouse transfer",
    keywords: "QA submission, release labelling, final documentation, warehouse transfer, supervisor sign off",
    answer:
      "Complete all remaining batch documentation, review for completeness, and obtain supervisor sign-off. Submit samples and documents to QA for review and approval. Once QA-approved labels are received, attach them to all drums and transfer to the warehouse for storage.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Steps 30-31",
    order: 14,
  },
  {
    category: "BLENDING_SOP",
    title: "Cleaning verification: ATP swab and conductivity test",
    keywords: "ATP swab test, conductivity test, cleaning verification, SOP C.103, acceptance criteria, failed cleaning",
    answer:
      "After fully cleaning the blending room, blender, and all equipment (removing residual powder, dust, and waste), perform ATP swab testing on designated critical contact surfaces per SOP C.103 (Environmental Monitoring and Cleaning Verification). Where wet cleaning was used, also run a conductivity test on the final rinse water to confirm detergent residue removal. Record both results against the acceptance criteria. If either test fails, repeat cleaning, investigate the cause, and re-test before releasing the equipment for use.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Step 34",
    order: 15,
  },
  {
    category: "BLENDING_SOP",
    title: "Final room check and exit at the end of blending",
    keywords: "final area check, exit procedure, jolt system, sign off, end of shift blending",
    answer:
      "Do a final inspection to confirm nothing is missing, no leftover materials or waste remain, and the area is clean and ready for the next use. Complete final verification and sign-off in the Jolt system. Dispose of used lab coats in the correct bin and wash your hands before leaving.",
    source: "Blending and Dispensing Procedure (SOP-OP-HI-DIS), Step 36",
    order: 16,
  },

  // ───────────────────── MACHINE TROUBLESHOOTING ─────────────────────
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Blockage in the capsule magazine",
    keywords: "capsule magazine blockage, magazine jam, capsules stuck magazine, magazine tracks",
    cause: "Capsules are too big or deformed; the magazine is jammed; or debris is stuck in the magazine tracks.",
    answer:
      "Make sure the capsules fit the Capsule Magazine size. Clean the Capsule Magazine tracks. If something is stuck in the tracks, use sandpaper to polish and clean them.",
    source: "Capsule filler common issues guide / FACF manual, Troubleshooting",
    order: 20,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Capsule caps and bodies do not separate",
    keywords: "caps and bodies not separating, capsule split fail, capsule separation problem, vacuum pressure low",
    cause: "Upper/lower die segments misaligned, die segment holes blocked, or vacuum pressure too low / pipe jammed / air leak.",
    answer:
      "Adjust the position of the die segments with the alignment tools and clean the segment holes. Ensure vacuum pressure is 0.06-0.08 MPa (NJP-800: -0.02 to -0.06 MPa) — check the vacuum pipes and clean the filter if it's low.",
    source: "FACF manual Troubleshooting p.92; NJP-800 manual Section 5.2.15",
    order: 21,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Capsule ends are being punched through",
    keywords: "capsule punched through, closing pin too high, pushing rod height",
    cause: "Upper/lower die segments misaligned, or the Capsule Closing Plate/Closing Pins are positioned too high.",
    answer:
      "Check the closing station and re-align the upper and lower die segments with the alignment tools. If the closing pins are too high, adjust the height of the pushing rod.",
    source: "FACF manual Troubleshooting p.92",
    order: 22,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Machine suddenly stops while running",
    keywords: "machine stops running, sudden stop, powder run out, motor overloaded, mechanical gear loose",
    cause: "Powder has run out, the powder exit is blocked, or a mechanical part is loose/damaged, or the electric motor is overloaded.",
    answer:
      "Add more powder if it has run out, and clear/unblock the powder exit of any solids. Check the machine for loose or damaged parts. If the motor is overloaded, repair and adjust it accordingly. On the NJP-800, also check for a loosened friction disk in the clutch.",
    source: "FACF manual Troubleshooting p.92; NJP-800 malfunction table",
    order: 23,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Vacuum breaker keeps tripping",
    keywords: "vacuum breaker trips, vacuum overworked, vacuum filter dirty, vacuum bag full",
    cause: "The vacuum system is being overworked.",
    answer:
      "Adjust the breaker with a crosshead screwdriver to slightly raise the amps. Clean the vacuum filter and empty the vacuum bag.",
    source: "FACF manual Troubleshooting p.92",
    order: 24,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Motor is running but the machine is not operating",
    keywords: "motor running machine not moving, drive belt loose, main gear bolt loose",
    cause: "The bolt on the motor's main gear is loose, affecting the drive belt's tension.",
    answer:
      "Tighten the bolt on the motor's main gear and make sure the drive belt has enough tension.",
    source: "FACF manual Troubleshooting p.92",
    order: 25,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Powder is stuck to capsules",
    keywords: "powder sticking to capsules, sticky powder, humidity static",
    cause: "The powder content is sticky, or the environment is too humid / has too much static.",
    answer:
      "Granulate the powder or add a lubricant to the mix. Reduce humidity in the room and ground the machine to remove static.",
    source: "FACF manual Troubleshooting p.92-93",
    order: 26,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "No powder feeding during automatic operation",
    keywords: "no powder feeding, powder height sensor damaged, feeder motor, electrics bad",
    cause: "The powder height sensor of the feeder motor is damaged, or the feed electrics are faulty.",
    answer:
      "Check the sensitivity of the powder height sensor, clean its switch, and/or adjust it. If the issue is electrical, check the circuit against the electrical diagrams in the manual appendix and contact an electrician if a component is damaged.",
    source: "FACF manual Troubleshooting p.93",
    order: 27,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Capsules are not closing properly",
    keywords: "capsules not closing, closing plate gap, powder too fluffy",
    cause: "The gap of the Capsule Closing Plate is too high, or the powder is too fluffy so the slug is too big for the capsule.",
    answer:
      "Make sure the Capsule Closing Plate gap is 0.2mm-0.3mm. If the powder is too fluffy, granulate it before filling.",
    source: "FACF manual Troubleshooting p.93",
    order: 28,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Filled capsules discharge unsmoothly / jam in the chute",
    keywords: "discharge chute jam, capsules stuck discharge, static electricity capsules, air compressor assist",
    cause: "Static electricity on the capsules, a jam in the discharge chute, or the Closing Plate elevation angle is too high.",
    answer:
      "Blow stuck capsules off the discharge chute with an air compressor and clean out any jam. Adjust the screws to reduce the Closing Plate elevation angle if needed. If capsules need assistance, connect an air compressor to the ejection area at 0.02 MPa.",
    source: "FACF manual Troubleshooting p.93",
    order: 29,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Capsules are not being sewn into the tooling",
    keywords: "capsule gate powder, bearing spring covered powder, capsule sewing problem",
    cause: "The bearing and spring inside the Capsule Gate's channel is covered with powder.",
    answer:
      "Remove the Capsule Gate, take out its set screw, spring, and ball bearing. Clear the channel of powder and clean the spring and bearing before reassembling.",
    source: "FACF manual Troubleshooting p.93",
    order: 30,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Powder is accumulating inside the die segment turret",
    keywords: "powder buildup turret, die segment turret powder, powder overfilling",
    cause: "Powder not granulated well, powder overfilling the die segments, or the turret hasn't been cleaned.",
    answer:
      "Granulate the powder before filling. If overfilling, reduce machine speed, reduce fill amount, or move to a larger capsule size. Empty the powder collector under the turret and vacuum it out.",
    source: "FACF manual Troubleshooting p.93",
    order: 31,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Capsules are piling up inside the machine",
    keywords: "capsules piling up, capsules not exiting ejection chute",
    cause: "Capsules are not exiting the ejection chute.",
    answer:
      "Attach an air compressor to the 8mm push fitting underneath the capsule ejection assembly to help capsules move down the chute correctly.",
    source: "FACF manual Troubleshooting p.93",
    order: 32,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Capsule caps are sucked into the rejection station",
    keywords: "caps sucked out, upper segment vacuum, rejection station",
    cause: "The vacuum pump pressure needs recalibrating.",
    answer:
      "Recalibrate the vacuum pump pressure following the vacuum pump pressure calibration instructions in the manual.",
    source: "FACF manual Troubleshooting p.93",
    order: 33,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Dents and pin holes in capsules",
    keywords: "dented capsules, pin holes capsules, overfilled capsules, moisture exposure",
    cause: "Capsules overfilled, exposed to moisture, or the pin sizes are incorrect / installed incorrectly.",
    answer:
      "Use a larger capsule size or reduce the powder amount. Improve capsule storage conditions to avoid moisture. Replace the tooling or reinstall the pins correctly.",
    source: "FACF manual Troubleshooting p.94",
    order: 34,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Telescoped capsules",
    keywords: "telescoping capsules, capsule fill weight too high, storage temperature variation",
    cause: "Worn/incorrectly installed components, fill weight too high, or storage temperature variation.",
    answer:
      "Adjust or replace worn components, lower the capsule fill weight, and store capsules in an area with consistent temperature.",
    source: "FACF manual Troubleshooting p.94",
    order: 35,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Improperly closed or overfilled capsules",
    keywords: "capsules not sealed, damaged sealing area, overfilled capsules",
    cause: "Damage to the body-cap sealing area, or capsules overfilled.",
    answer:
      "Replace damaged capsules. Use larger capsules or reduce the powder amount if overfilling is the cause.",
    source: "FACF manual Troubleshooting p.94",
    order: 36,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Cracked capsules",
    keywords: "cracked capsules, capsule die segments misaligned, pin size wrong",
    cause: "Moisture exposure, misaligned die segments, or incorrectly installed pin sizes.",
    answer:
      "Improve capsule storage conditions to prevent moisture exposure, adjust the die segment alignment, and reinstall the pins correctly.",
    source: "FACF manual Troubleshooting p.94",
    order: 37,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "Dusty capsules coming off the machine",
    keywords: "dusty capsules, capsule polisher",
    cause: "Capsules are not being polished after filling.",
    answer:
      "Run filled capsules through a capsule polisher after filling.",
    source: "FACF manual Troubleshooting p.94",
    order: 38,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "How to de-jam the machine (disfigured capsules or powder buildup)",
    keywords: "de-jam machine, jammed machine, disfigured capsules stuck, remove jam",
    answer:
      "Always unplug the machine before de-jamming. Method 1 (disfigured capsules): remove the Capsule Hopper and Capsule Magazine, take apart the magazine, and remove stuck/damaged capsules. Method 2 (powder buildup): remove the Powder Hopper, Auger, and tamping tooling, wash each part in soapy water, use a toothbrush on stubborn debris, dry, and sanitize before reassembling.",
    source: "FACF manual, De-Jamming section p.95-96",
    order: 39,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "NJP-2500: Capsule can't be conveyed",
    keywords: "njp2500 njp800 capsule not conveyed, capsule convey plate jammed, defect capsules tank",
    cause: "Intake of the capsule convey plate jammed by defect capsules; convey switch position wrong; or the immobility piece is damaged/misaligned.",
    answer:
      "Remove defective capsules from the capsule tank with a long pin. Adjust the position of the capsule conveying switch. Replace the immobility piece or adjust its angle if it's damaged or misaligned. (Steps adapted from the NJP-800C manual — part names should match the NJP series generally, but confirm against your NJP-2500 manual if anything looks different.)",
    source: "NJP-800C manual, Section 8 malfunction table (NJP-2500, unverified against model-specific manual)",
    order: 40,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "NJP-2500: Low ratio of capsule mount / caps not splitting into upper mold",
    keywords: "njp2500 njp800 low capsule mount ratio, horizontal fork position, vacuum pressure too big",
    cause: "The horizontal fork position is off, or vacuum pressure is too high so caps can't enter the upper mold block to split.",
    answer:
      "Adjust the position of the horizontal fork. If vacuum pressure is too high, adjust the vacuum valves to reduce it. (Steps adapted from the NJP-800C manual — confirm against your NJP-2500 manual if anything looks different.)",
    source: "NJP-800C manual, Section 8 malfunction table (NJP-2500, unverified against model-specific manual)",
    order: 41,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "NJP-2500: Capsules can't be split normally",
    keywords: "njp2500 njp800 capsule split fail, mold block holes dirty, concentricity mold block, vacuum too low",
    cause: "Vacuum too low; mold block holes dirty; mold block hole concentricity off; capsule fragments jammed in the sucker air vent; mold block damaged; or vacuum pipeline jammed.",
    answer:
      "Adjust the vacuum valves to increase vacuum. Clean the holes of the upper and lower mold blocks. Regulate mold block hole concentricity with the regulating rod. Clear capsule fragments from the sucker air vent with a pin hook. Replace the mold block if damaged, or clean the vacuum pipeline if jammed. (Steps adapted from the NJP-800C manual — confirm against your NJP-2500 manual if anything looks different.)",
    source: "NJP-800C manual, Section 8 malfunction table (NJP-2500, unverified against model-specific manual)",
    order: 42,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "NJP-2500: Capsules lock in position, crack, or pit",
    keywords: "njp2500 njp800 capsule crack pit, locking pin torched, point pin height, dosage excessive",
    cause: "Mold block hole concentricity off; the locking point pin is torched, dirty, or set too high/low; mold block holes damaged/worn; or dosage is excessive.",
    answer:
      "Regulate the mold block concentricity with the regulating rod. Adjust or replace the point pin and clean its end surface. Adjust the height of the point pin. Replace the mold block if the holes are damaged or worn. If dosage is excessive, this must be adjusted by the manufacturer. (Steps adapted from the NJP-800C manual — confirm against your NJP-2500 manual if anything looks different.)",
    source: "NJP-800C manual, Section 8 malfunction table (NJP-2500, unverified against model-specific manual)",
    order: 43,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "NJP-2500: Main motor stopped by fault",
    keywords: "njp2500 njp800 main motor stopped, friction disk clutch loosened, dosage disk friction, humidity",
    cause: "The friction disk of the clutch has loosened, or friction between the dosage disk's lower face and the copper ring's upper face is too high.",
    answer:
      "Adjust the pressure of the friction piece. If friction between the dosage disk and copper ring is the cause, reduce the relative humidity of the production environment and adjust the clearance of the dosage disk's lower level. (Steps adapted from the NJP-800C manual — confirm against your NJP-2500 manual if anything looks different.)",
    source: "NJP-800C manual, Section 8 malfunction table (NJP-2500, unverified against model-specific manual)",
    order: 44,
  },
  {
    category: "MACHINE_TROUBLESHOOTING",
    title: "NJP-800C reference clearances (vacuum, powder wiper, closing plate)",
    keywords: "njp2500 njp800 clearance specs, vacuum degree, sealing ring clearance, powder wiper clearance, dosing disk gap",
    answer:
      "Caution: these exact numbers are from the NJP-800C manual and have NOT been confirmed for the NJP-2500 — different models in the NJP range can use different clearances. Treat these as a reference only and verify against your NJP-2500 manual or nameplate before adjusting anything. NJP-800C reference values: vacuum degree -0.02 to -0.06 MPa; clearance between dosing disk and sealing ring 0.03-0.08mm; powder wiper-to-dosing-disk clearance 0.05-0.1mm; clearance between joining baffle and capsule 0.5-0.8mm.",
    source: "NJP-800C manual, Section 5.2 Adjustment procedures (NOT verified for NJP-2500)",
    order: 45,
  },

  // ───────────────────── MAINTENANCE / CLEANING ─────────────────────
  {
    category: "MAINTENANCE_CLEANING",
    title: "NJP-800C reference lubrication schedule",
    keywords: "njp2500 njp800 lubrication schedule, grease schedule, chain lubrication, division box oil, how often lubricate machine, lubricate machine",
    answer:
      "Caution: this schedule is from the NJP-800C manual and has NOT been confirmed for the NJP-2500 — treat the specific oil grades and hour intervals as reference only until checked against your NJP-2500 manual. NJP-800C reference schedule — Weekly: coat cam roller surfaces with grease, drip-lubricate joint bearings under the bench, and check/lubricate the driving chain for tightness. Monthly: check the main driving reducer and powder-feeding reducer oil volume, topping up as needed (replace every 6 months). Every 1000 hours: first replacement of division box lubrication oil (90# engine oil, viscosity 680-460), then every 3000 hours after that. Weekly: remove the revolving platform cover and lubricate the T-type shaft, brass sleeve, and bearing; every 1000 hours, fully clean/replace/re-lubricate the T-type shaft and sealing ring. Reference lubricants: Machine oil N4B for chains/guides, No.2 lithium grease ZL2 for cams/bearings/chain, and No.0 lithium grease ZLD for the division box and speed reducer.",
    source: "NJP-800C manual, Section 7 Maintenance and Cleaning (NOT verified for NJP-2500)",
    order: 50,
  },
  {
    category: "MAINTENANCE_CLEANING",
    title: "FACF general lubrication schedule",
    keywords: "facf lubrication schedule, grease points, NLGI grade 1, weekly grease, how often lubricate machine, lubricate machine",
    answer:
      "Visually inspect and grease all cam/bearing surfaces (Rejection, Press, Main Shaft Support, End Production Press, Dosing, and Vacuum driving assemblies) whenever they appear dry — cams weekly, bearings on a regular ongoing basis. Use NLGI Grade 1 grease. Apply lubrication oil to joint bearings, sealing bearings, and sliding guides, and check driving chain tightness regularly, applying lubricant as needed. Replenish oil in the main driving and feeder decelerators.",
    source: "FACF manual, Maintenance & Lubrication Schedule p.45-46",
    order: 51,
  },
  {
    category: "MAINTENANCE_CLEANING",
    title: "Daily cleaning routine after machine operation",
    keywords: "after use cleaning, end of shift machine clean, capsule hopper cleaning, powder hopper cleaning",
    answer:
      "Unplug the machine and remove excess powder with a bagless vacuum. Clean the Capsule Hopper, Powder Hopper, Capsule Magazine and teeth, Tooling, and Auger with soapy water (one part at a time), rinse, dry immediately, and sanitize with a clean cloth. Wipe down other surfaces with a damp cloth. Lubricate all grease points afterward, and store Tooling in a container with a small amount of grease.",
    source: "FACF manual, Cleaning section p.97-98 and Maintenance Checklist p.111",
    order: 52,
  },
  {
    category: "MAINTENANCE_CLEANING",
    title: "Cleaning schedule matrix — what to clean and when",
    keywords: "cleaning schedule matrix, wet clean dry clean, weekly monthly cleaning, cross contamination cleaning",
    answer:
      "Capsule Hopper, Powder Hopper, Base, Closing Tooling, and Magazine/Teeth each have their own cleaning level depending on timing: after installing, after every use, before every use, between products with cross-contamination risk, weekly, monthly, before/after storage. Levels run from Level 1 (remove powder) to Level 4 (wet clean and re-lubricate). Always confirm the specific schedule against your Food Safety/QC department's material safety data sheets — this matrix is a guide, not an exhaustive rule.",
    source: "FACF manual, Cleaning Schedule Matrix p.99",
    order: 53,
  },
  {
    category: "MAINTENANCE_CLEANING",
    title: "Pre-operation, during-operation, and post-operation maintenance checklist",
    keywords: "maintenance checklist, before operation checks, during operation checks, after operation checks",
    answer:
      "Before operation: visually inspect the machine and parts, ensure nuts/bolts are tight, check and re-grease points, run at slow speed to confirm correct operation, and inspect wiring. During operation: tune the fill/weight, listen for irregular knocking (stop and investigate if heard), watch for powder buildup on the Auger, monitor motor temperature, keep hoppers topped up, weigh sample capsules regularly, and confirm the Emergency Stop works. After operation: unplug, vacuum out powder, clean the hoppers/magazine/tooling/auger, wipe surfaces, lubricate grease points, and store tooling with grease.",
    source: "FACF manual, Maintenance Checklist p.111",
    order: 54,
  },
  {
    category: "MAINTENANCE_CLEANING",
    title: "Storing the machine or tooling for more than a week",
    keywords: "storing machine, storing tooling, rust prevention, long term storage capsule filler",
    answer:
      "If not using the machine for more than a week, store the Tooling in containers covered in lubricant to prevent rust. Otherwise, lubricate each Tooling part and reinsert it. Apply a layer of grease to cams/rollers, lubrication oil to joint/sealing bearings and sliding guides, grease the ball/needle/linear bearings, check driving chain tightness, and replenish the main driving/feeder decelerator oil. Cover the machine with plastic wrapping and keep it in an 18-24°C / 45-55% RH environment.",
    source: "FACF manual, Storing the FACF Range p.100",
    order: 55,
  },
  {
    category: "MAINTENANCE_CLEANING",
    title: "Wear parts to watch and why they wear",
    keywords: "wear parts, capsule holding pins, tamping pin springs, dosing disk wear ring, spacing washer",
    answer:
      "Capsule Holding Pins can be damaged during a jam, cleaning, or mishandling. Plastic inserts for the capsule segment wear over time and can leak fine powder. Tamping Pins may need replacing after a hard stop or with caustic/abrasive product. Tamping Pin Springs lose tension over many compressions, affecting capsule weight and jam protection. The Dosing Disk Wear Ring wears down from constant rotation. The Spacing Washer calibrates the tamping pins and is easy to lose during cleaning or strip-down. Capsule Ejection Springs can bend during cleaning or maintenance.",
    source: "FACF manual, Wear Parts and Causes of Damage p.49",
    order: 56,
  },

  // ───────────────────────────── SAFETY ─────────────────────────────
  {
    category: "SAFETY",
    title: "Personal protection while operating the capsule filler",
    keywords: "safety ppe machine operation, safety goggles, gloves machine, hairnet food grade, entanglement risk",
    answer:
      "Avoid loose jewelry and contain long hair to prevent entanglement with moving parts. Wear safety goggles and disposable latex/rubber gloves. Wear a hairnet and beard net for food-grade products. Keep fingers away from all moving parts and inspect the machine before use.",
    source: "FACF manual, Important Safety Information p.3",
    order: 60,
  },
  {
    category: "SAFETY",
    title: "General hazards and emergency stop",
    keywords: "emergency stop, general hazards, electrical shock risk, wet hands, exposed wires",
    answer:
      "In an emergency, immediately push the Emergency Stop button or isolator switch and unplug the machine. Do not let powder collect at the Turret and Tamping Station. Never operate in a wet environment or with wet hands, and never operate if any wires are exposed — risk of electrical shock or burn. Use extreme caution servicing electrical components, and never modify the machine.",
    source: "FACF manual, Important Safety Information p.3",
    order: 61,
  },
  {
    category: "SAFETY",
    title: "Explosive material warning",
    keywords: "explosive powder warning, grounding machine, explosivity test materials",
    answer:
      "The machine is not explosion-proof. Ensure it is properly grounded, and test any new material's explosivity before running it through the machine. Do not use materials confirmed to be explosive.",
    source: "FACF manual, Warning for Explosive Material p.4",
    order: 62,
  },
  {
    category: "SAFETY",
    title: "Always unplug before de-jamming, cleaning, or replacing parts",
    keywords: "unplug before maintenance, lockout before cleaning, safety before replacing parts",
    answer:
      "Always unplug the machine from the electrical outlet before de-jamming, cleaning, or removing/replacing any parts. Wear latex/rubber gloves and appropriate food-grade attire during these processes.",
    source: "FACF manual, Maintenance & De-Jamming sections",
    order: 63,
  },

  // ───────────────────────────── PARTS ─────────────────────────────
  {
    category: "PARTS",
    title: "Closing pin sizing for the 16 CT encapsulator",
    keywords: "closing pin size chart, guide plate size, capsule size pin, I-20-0239",
    answer:
      "Closing pins for the 16 CT machine are sized by diameter: 4.0mm (capsule sizes 2-5), 4.5mm (sizes 2-4), 5.0mm (sizes 0-1), 5.5mm (sizes 00-0), 6.0mm (sizes 00-0), 6.5mm (size 00). Each pin size requires its own matching guide plate — check the part number chart before swapping sizes.",
    source: "Capsule Machine Parts catalog (Index 16 CT), Closing Station p.36",
    order: 70,
  },
  {
    category: "PARTS",
    title: "What tooling changes when switching capsule size",
    keywords: "change capsule size tooling, format change parts, dosing disc segments",
    answer:
      "A full capsule-size format change on the 16 CT machine swaps the Dosing Disc, Magazine Complete, Upper/Lower Segments, Horizontal/Vertical Fingers, Orientation Block, and the size-matched Tamper/Segment Alignment Pins and Closing Pins with their matching guide plate. On the NJP-800, replace the upper/lower die assembly, capsule-feeding plate, horizontal fork, vertical fork, straightener, filling rod, and dosing disk.",
    source: "Capsule Machine Parts catalog p.2-4; NJP-800 manual Section 5.1",
    order: 71,
  },
  {
    category: "PARTS",
    title: "Common spare parts worth keeping on hand",
    keywords: "spare parts stock, common spares, powder wiper, tamping pin holder, separation pin",
    answer:
      "Frequently replaced parts on the 16 CT encapsulator include the Powder Wiper, Powder Ring Plate, Tamper Guide Plate, Ejection Pins and Guide Plate, Separation Pins and Holder Plate, and the Tamping Pin Holder Assembly. Keep spares of these on hand to minimize downtime during a breakdown.",
    source: "Capsule Machine Parts catalog, Common Spare Parts p.7-10",
    order: 72,
  },
];

async function main() {
  console.log(`Seeding ${entries.length} Ask Dhanu knowledge base entries...`);
  for (const e of entries) {
    const existing = await prisma.knowledgeEntry.findFirst({
      where: { title: e.title, category: e.category },
    });
    if (existing) {
      await prisma.knowledgeEntry.update({ where: { id: existing.id }, data: e });
    } else {
      await prisma.knowledgeEntry.create({ data: e });
    }
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
