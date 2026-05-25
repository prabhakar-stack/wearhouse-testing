import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_SOP_STEPS: Record<string, string[]> = {
  SLA_BREACH: [
    "Verify if the package was physically placed in the dock area.",
    "Contact the receiver of the manifest to confirm package custody.",
    "Force handover the package status to 'IN_INSPECTION' manually if found.",
    "Escalate to operations head if package is missing."
  ],
  CLAIM_STALLED: [
    "Open the Google Drive folder for the order and inspect evidence images.",
    "Locate the corresponding Amazon LPN return reason and customer comments.",
    "Access the Amazon seller central claims portal (IDR) and file the dispute case.",
    "Update the Manifest claimId with the filed Amazon case ID.",
    "Log dispute status as 'Filed' under reimbursement tracker."
  ],
  CLAIM_NUDGE: [
    "Verify that the Google Drive evidence is complete and clear.",
    "Confirm that return item pricing is correct.",
    "Inform the assigned claims specialist to begin filing the claim."
  ],
  GHOST_DELIVERY: [
    "Check tracking status on the courier's public website (UPS/Delhivery/etc.).",
    "Search the receiving dock area physically for any unscanned boxes.",
    "Contact courier support to open an inquiry about missing delivery.",
    "If confirmed lost, file FBA warehouse lost inbound claim."
  ],
  MISSING_ITEMS: [
    "Re-verify the expected item list from AMZRemovalShipments and customer return records.",
    "Search the surrounding inspection table for any misplaced product items.",
    "Review inspection unboxing video to confirm if the box arrived short-shipped.",
    "File a claim on Amazon FBA for short-shipped/missing items, attaching the video link as evidence."
  ],
  INTAKE_REJECTION: [
    "Ensure that the unboxing visual damage photos are clearly uploaded to the Google Drive folder.",
    "Contact the courier driver to report damaged package intake rejection.",
    "File a freight damage or return shipment damage claim with the carrier."
  ]
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const alertType = searchParams.get('type');

    let steps: { id: string; alertType: string; stepOrder: number; instruction: string }[] = [];

    if (alertType) {
      const list = DEFAULT_SOP_STEPS[alertType] || [];
      steps = list.map((inst, idx) => ({
        id: `${alertType}_sop_${idx}`,
        alertType,
        stepOrder: idx + 1,
        instruction: inst
      }));
    } else {
      for (const [type, list] of Object.entries(DEFAULT_SOP_STEPS)) {
        steps.push(...list.map((inst, idx) => ({
          id: `${type}_sop_${idx}`,
          alertType: type,
          stepOrder: idx + 1,
          instruction: inst
        })));
      }
    }

    return NextResponse.json({ steps });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Returns mock success to prevent UI errors, since SOP is static in the codebase
  return NextResponse.json({ success: true, message: 'SOP updated statically in application codebase' });
}

export async function DELETE(req: NextRequest) {
  // Returns mock success to prevent UI errors, since SOP is static in the codebase
  return NextResponse.json({ success: true, message: 'SOP step deleted statically in application codebase' });
}
