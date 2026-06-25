import { Parser } from 'expr-eval';

const parser = new Parser();

function evaluateFormula(formula, vars) {
  try {
    const expr = parser.parse(formula);
    return expr.evaluate(vars);
  } catch {
    return 0;
  }
}

export function calculateQuote(template, measurements, materialPrices, settings) {
  const vars = { ...measurements };

  if (vars.length != null && vars.width != null) {
    vars.area = vars.length * vars.width;
    vars.perimeter = 2 * (vars.length + vars.width);
  }

  if (vars.floorArea != null) vars.area = vars.floorArea;

  const materialLines = template.defaultMaterials.map(mat => {
    const wf = mat.wasteFactor ?? 1.0;
    const varsWithWaste = { ...vars, wasteFactor: wf };

    const rawQty = evaluateFormula(mat.qtyFormula, varsWithWaste);
    const qty = Math.ceil(rawQty);

    const priceEntry = materialPrices[mat.materialId];
    const unitPrice = priceEntry?.userPrice ?? priceEntry?.defaultPrice ?? 0;

    const total = qty * unitPrice;

    return {
      materialId: mat.materialId,
      name: priceEntry?.name ?? mat.materialId,
      qty,
      unitPrice,
      wasteFactor: wf,
      total,
    };
  });

  const postsLine = materialLines.find(m => m.materialId.includes('post'));
  if (postsLine) {
    vars.posts = postsLine.qty;

    for (let i = 0; i < materialLines.length; i++) {
      const mat = template.defaultMaterials[i];
      if (mat.qtyFormula.includes('posts') && !mat.materialId.includes('post')) {
        const wf = mat.wasteFactor ?? 1.0;
        const rawQty = evaluateFormula(mat.qtyFormula, { ...vars, wasteFactor: wf });
        materialLines[i].qty = Math.ceil(rawQty);
        materialLines[i].total = materialLines[i].qty * materialLines[i].unitPrice;
      }
    }
  }

  const autoCalcItems = [];
  const area = vars.area || 0;
  const perimeter = vars.perimeter || 0;

  if (area > 0 && settings.concreteRatePerM3) {
    const thickness = vars.thickness || vars.depth || 0.1;
    const volume = Math.ceil(area * thickness * 10) / 10;
    if (volume > 0) {
      const cost = Math.round(volume * settings.concreteRatePerM3);
      autoCalcItems.push({ materialId: 'auto_concrete', name: `Concrete (${volume}m³)`, qty: 1, unitPrice: cost, total: cost, wasteFactor: 1.0, autoCalc: true });
    }
  }
  if (area > 0 && settings.reoRatePerSqm) {
    const cost = Math.round(area * settings.reoRatePerSqm);
    autoCalcItems.push({ materialId: 'auto_reo', name: `Reo Mesh (${area}m²)`, qty: 1, unitPrice: cost, total: cost, wasteFactor: 1.0, autoCalc: true });
  }
  if (area > 0 && settings.fixingsRatePerSqm) {
    const cost = Math.round(area * settings.fixingsRatePerSqm);
    autoCalcItems.push({ materialId: 'auto_fixings', name: `Screws & Fixings (${area}m²)`, qty: 1, unitPrice: cost, total: cost, wasteFactor: 1.0, autoCalc: true });
  }
  if (perimeter > 0 && settings.formworkRatePerLm) {
    const cost = Math.round(perimeter * settings.formworkRatePerLm);
    autoCalcItems.push({ materialId: 'auto_formwork', name: `Formwork (${perimeter}lin.m)`, qty: 1, unitPrice: cost, total: cost, wasteFactor: 1.0, autoCalc: true });
  }

  const allMaterialLines = [...materialLines, ...autoCalcItems];

  const labourHours = Math.ceil(evaluateFormula(template.labourFormula, vars) * 10) / 10;
  const labourRate = settings.labourRate ?? 6500;
  const labourCost = Math.round(labourHours * labourRate);

  const travelCost = settings.defaultTravelCost ?? 5000;

  const materialsTotal = allMaterialLines.reduce((sum, m) => sum + m.total, 0);

  const consumablesPercent = template.consumablesPercent ?? 5;
  const consumablesCost = Math.round(materialsTotal * (consumablesPercent / 100));

  const subtotal = materialsTotal + labourCost + travelCost + consumablesCost;

  const markupPercent = settings.markupPercent ?? 20;
  const markup = Math.round(subtotal * (markupPercent / 100));
  const beforeTax = subtotal + markup;

  const taxRate = settings.taxRate ?? 10;
  const taxAmount = Math.round(beforeTax * (taxRate / 100));
  const totalPrice = beforeTax + taxAmount;

  return {
    materials: allMaterialLines,
    materialsTotal,
    labourHours,
    labourRate,
    labourCost,
    travelCost,
    consumablesCost,
    consumablesPercent,
    subtotal,
    markupPercent,
    markup,
    beforeTax,
    taxRate,
    taxAmount,
    totalPrice,
  };
}
