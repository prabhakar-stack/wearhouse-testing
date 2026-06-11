import { NextRequest, NextResponse } from 'next/server';
import { SOP_MAP, ALERT_RULES } from '@/lib/alertRules';
import { normalizeLanguage, translateInstruction } from '@/lib/i18n';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const alertType = searchParams.get('type');
    let preferredLanguage = normalizeLanguage(req.headers.get('x-user-language'));

    let steps: { id: string; alertType: string; stepOrder: number; instruction: string }[] = [];

    if (alertType) {
      const rule = ALERT_RULES.find(r => r.type === alertType);
      const list = rule?.sopSteps || [];
      steps = list.map((step, idx) => ({
        id: `${alertType}_sop_${idx}`,
        alertType,
        stepOrder: idx + 1,
        instruction: preferredLanguage === 'hi' ? step.hi : step.en
      }));
    } else {
      // Return all SOP steps for all registered alert types
      for (const rule of ALERT_RULES) {
        steps.push(...rule.sopSteps.map((step, idx) => ({
          id: `${rule.type}_sop_${idx}`,
          alertType: rule.type,
          stepOrder: idx + 1,
          instruction: preferredLanguage === 'hi' ? step.hi : step.en
        })));
      }
    }

    return NextResponse.json({ steps });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Returns mock success — SOP steps are managed centrally in lib/alertRules.ts
  return NextResponse.json({ success: true, message: 'SOP is managed centrally in lib/alertRules.ts' });
}

export async function DELETE(req: NextRequest) {
  // Returns mock success — SOP steps are managed centrally in lib/alertRules.ts
  return NextResponse.json({ success: true, message: 'SOP is managed centrally in lib/alertRules.ts' });
}
