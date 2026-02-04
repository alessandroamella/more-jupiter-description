import { file } from 'bun';
import { enGB, it, type Locale } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import {
  isValidPhoneNumber,
  parsePhoneNumberWithError,
} from 'libphonenumber-js';
import { z } from 'zod';

// ==========================================
// 1. CONFIGURATION
// ==========================================
const PORT = process.env.PORT || 3000;
const TIMEZONE = 'Europe/Rome';
const DEFAULT_PHONE_COUNTRY = 'IT';

// ==========================================
// 2. SCHEMAS (Merged)
// ==========================================

// Schema A: For Description Generation
const DescSchema = z.object({
  eventName: z.string().min(1, 'Il nome evento è obbligatorio'),
  shortDescriptions: z.object({
    it: z.string().min(1, 'Description cannot be empty'),
    en: z.string().min(1, 'Description cannot be empty').optional(),
    es: z.string().min(1, 'Description cannot be empty').optional(),
  }),
  location: z.string().min(1),
  fee: z.number().min(0),
  eventDate: z.iso.datetime(),
  registrationDeadline: z.iso.datetime(),
  paymentDeadline: z.iso.datetime(),
  fidelityPointsModena: z.number().int().nonnegative(),
  fidelityPointsReggio: z.number().int().nonnegative(),
  contactName: z.string().min(1),
  contactPhone: z
    .string()
    .refine((val) => isValidPhoneNumber(val, DEFAULT_PHONE_COUNTRY), {
      message: 'Numero di telefono non valido',
    }),
});

// Schema B: For Script Generation
const ScriptSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  placeName: z.string().min(1, 'Place name is required'),
  placeAddress: z.string().min(1, 'Address is required'),
  eventStart: z.iso.datetime({ offset: true }).or(z.string()),
  eventEnd: z.iso.datetime({ offset: true }).or(z.string()),
  registrationStart: z.iso.datetime({ offset: true }).or(z.string()),
  registrationEnd: z.iso.datetime({ offset: true }).or(z.string()),
  descriptionIT: z.string().default(''),
  descriptionEN: z.string().default(''),
  descriptionES: z.string().optional(),
  autoConfirm: z.boolean().default(true),
  alumniEnabled: z.boolean().default(false),
  exchangeStudentsEnabled: z.boolean().default(true),
  esnersEnabled: z.boolean().default(true),
  newbiesEnabled: z.boolean().default(true),
  maxParticipants: z.number().int().positive(),
  maxWaitingList: z.number().int().nonnegative(),
  esnCardRequired: z.boolean().default(true),
});

// ==========================================
// 3. LOGIC & HELPERS
// ==========================================

// --- Description Helpers ---
const formatDate = (isoDate: string, locale: Locale, separator: string) => {
  return formatInTimeZone(
    new Date(isoDate),
    TIMEZONE,
    `dd/MM/yyyy '${separator}' HH:mm`,
    { locale },
  );
};

const formatCurrency = (amount: number, localeStr: string) => {
  const hasDecimals = amount % 1 !== 0;
  return new Intl.NumberFormat(localeStr, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace(/\s/g, '');
};

type LanguageConfig = {
  locale: Locale;
  localeStr: string;
  timeSeparator: string;
  getDescription: (data: z.infer<typeof DescSchema>) => string | null;
  labels: {
    when: string;
    where: string;
    fee: string;
    regDeadline: string;
    payDeadline: string;
    howToPayHeader: string;
    paymentInfo: (contactName: string, eventName: string) => string;
    fidelity: string;
    fidelityFormat: (modena: number, reggio: number) => string;
    contact: string;
  };
};

const LOCALES = {
  it: {
    locale: it,
    localeStr: 'it-IT',
    timeSeparator: 'alle',
    getDescription: (data) => data.shortDescriptions.it,
    labels: {
      when: '📅 QUANDO',
      where: '📌 DOVE',
      fee: '💰 FEE',
      regDeadline: '⏲️ DEADLINE per le ISCRIZIONI',
      payDeadline: '⏲️ DEADLINE per i PAGAMENTI',
      howToPayHeader: '**COME PAGARE**',
      paymentInfo: (contactName: string, eventName: string) =>
        `- tramite contanti o POS nel nostro ufficio a  [Modena](https://www.google.it/maps/place/Via+Ganaceto,+44,+41121+Modena+MO/@44.6483847,10.9220294,17z/data=!3m1!4b1!4m6!3m5!1s0x477fef13dd158f3d:0x51258ed00ccc5826!8m2!3d44.6483847!4d10.9246043!16s%2Fg%2F11c2bqmw_b?entry=ttu)\n- tramite contanti nel nostro ufficio a [Reggio Emilia](https://www.google.it/maps/place/Via+Francesco+Cassoli,+1,+42123+Reggio+Emilia+RE/@44.6923692,10.6277506,17z/data=!3m1!4b1!4m6!3m5!1s0x47801c583ebe73b9:0x1c01d12d02d7a4fc!8m2!3d44.6923692!4d10.6303255!16s%2Fg%2F11c27s25pd?entry=ttu)\n- tramite bonifico a questo IBAN (intestato a ESN Modena e Reggio Emilia - ETS): **IT36Q0200812930000104489759**\n- tramite [Satispay](https://drive.google.com/file/d/1GKRau0IsgBg3NwJpse6g619l9l6jwFw0/view?usp=sharing), cercando "ESN Modena" sull'applicazione\n\nNel caso si paghi tramite bonifico/Satispay bisogna **INVIARE LA RICEVUTA AL RESPONSABILE** con la causale "*${contactName} - ${eventName}*"!\n\nPer partecipare è obbligatorio iscriversi su Jupiter, e la conferma avverrà solo dopo il pagamento.`,
      fidelity: 'Fidelity Points',
      fidelityFormat: (modena: number, reggio: number) =>
        `${modena} per Modena, ${reggio} per Reggio Emilia`,
      contact: '*Per ogni problema o dubbio contattare*:',
    },
  },
  en: {
    locale: enGB,
    localeStr: 'en-US',
    timeSeparator: 'at',
    getDescription: (data) => data.shortDescriptions.en ?? null,
    labels: {
      when: '📅 WHEN',
      where: '📌 WHERE',
      fee: '💰 FEE',
      regDeadline: '⏲️ DEADLINE for REGISTRATIONS',
      payDeadline: '⏲️ DEADLINE for PAYMENTS',
      howToPayHeader: '**HOW TO PAY 💳:**',
      paymentInfo: (contactName: string, eventName: string) =>
        `- by cash or POS at our office in [Modena](https://www.google.it/maps/place/Via+Ganaceto,+44,+41121+Modena+MO/@44.6483847,10.9220294,17z/data=!3m1!4b1!4m6!3m5!1s0x477fef13dd158f3d:0x51258ed00ccc5826!8m2!3d44.6483847!4d10.9246043!16s%2Fg%2F11c2bqmw_b?entry=ttu)\n- by cash at our office in [Reggio Emilia](https://www.google.it/maps/place/Via+Francesco+Cassoli,+1,+42123+Reggio+Emilia+RE/@44.6923692,10.6277506,17z/data=!3m1!4b1!4m6!3m5!1s0x47801c583ebe73b9:0x1c01d12d02d7a4fc!8m2!3d44.6923692!4d10.6303255!16s%2Fg%2F11c27s25pd?entry=ttu)\n- by bank transfer to this IBAN (holder -> ESN Modena e Reggio Emilia - ETS): **IT36Q0200812930000104489759**\n- by [Satispay](https://drive.google.com/file/d/1GKRau0IsgBg3NwJpse6g619l9l6jwFw0/view?usp=sharing), searching for "ESN Modena" on the application\n\nIn case you pay by bank transfer/Satispay you have to **SEND THE RECEIPT TO THE RESPONSIBLE** with the reason "*${contactName} - ${eventName}*"!\n\nTo participate it's mandatory to register on Jupiter, and confirmation will only take place after payment.`,
      fidelity: 'Fidelity Points',
      fidelityFormat: (modena: number, reggio: number) =>
        `${modena} for Modena, ${reggio} for Reggio Emilia`,
      contact: '*For any problems or doubts please contact*:',
    },
  },
} satisfies Record<string, LanguageConfig>;

// --- Script Helpers ---
const getCoreScript = () => `
/** AUTO FILL EVENT FORM SCRIPT (Generated) */
async function autoFillEventForm(data) {
    console.log("🚀 Starting Auto-fill process V2...");
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const setInputValue = (domElement, value) => {
        if (!domElement) { console.warn(\`⚠️ Input not found for: "\${value}"\`); return; }
        domElement.value = value;
        domElement.dispatchEvent(new Event('input', { bubbles: true }));
        domElement.dispatchEvent(new Event('change', { bubbles: true }));
        domElement.dispatchEvent(new Event('blur', { bubbles: true }));
    };
    const clickElement = (domElement, label = "element") => {
        if (!domElement) { console.warn(\`⚠️ Click target [\${label}] not found.\`); return; }
        domElement.click();
    };
    const typeIntoEditor = async (selector, text) => {
        const el = document.querySelector(selector);
        if (!el) return;
        clickElement(el, "Editor Focus");
        await wait(200);
        const success = document.execCommand('insertText', false, text);
        if (!success) { el.textContent = text; el.dispatchEvent(new Event('input', { bubbles: true })); }
        await wait(200);
    };

    // 1. NAME
    const titleEl = document.querySelector("textarea-component ion-input input") || document.querySelector("#main-content textarea-component input");
    setInputValue(titleEl, data.title);

    // 2. PLACE
    const addressInputs = document.querySelectorAll("address-event ion-input input");
    if (addressInputs.length >= 2) {
        setInputValue(addressInputs[0], data.placeName);    
        setInputValue(addressInputs[1], data.placeAddress); 
    }

    // 3. DATES
    const italianMonths = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    async function handleDatePicker(triggerElement, dateStr) {
        if (!triggerElement) return;
        const targetDate = new Date(dateStr);
        let min = targetDate.getMinutes();
        const remainder = min % 5;
        if (remainder !== 0) min += (5 - remainder);
        targetDate.setMinutes(min);

        triggerElement.click();
        await wait(800); 
        const pickers = document.querySelectorAll('idea-calendar-picker');
        const picker = pickers[pickers.length - 1]; 
        if (!picker) return;

        const yearInput = picker.querySelector('input[placeholder="Anno"]');
        if (yearInput) { yearInput.value = targetDate.getFullYear(); yearInput.dispatchEvent(new Event('input', { bubbles: true })); await wait(300); }

        const allCols = Array.from(picker.querySelectorAll('ion-col'));
        let monthCol = null;
        for(let col of allCols) { if(italianMonths.includes(col.innerText.trim().toLowerCase())) { monthCol = col; break; } }

        if (monthCol) {
            const parentRow = monthCol.parentElement;
            const prevBtn = parentRow.querySelectorAll('ion-button')[0];
            const nextBtn = parentRow.querySelectorAll('ion-button')[1];
            let safety = 0;
            while(safety < 12) {
                const currentTxt = monthCol.innerText.trim().toLowerCase();
                const currentIdx = italianMonths.indexOf(currentTxt);
                const targetIdx = targetDate.getMonth();
                if(currentIdx === targetIdx) break;
                if(currentIdx < targetIdx) clickElement(nextBtn, "Next Month");
                else clickElement(prevBtn, "Prev Month");
                await wait(250);
                safety++;
            }
        }

        const targetDay = targetDate.getDate().toString();
        const btns = Array.from(picker.querySelectorAll('ion-button'));
        for(let btn of btns) { if(btn.innerText.trim() === targetDay) { clickElement(btn, \`Day \${targetDay}\`); break; } }
        await wait(500);

        const targetHour = targetDate.getHours().toString().padStart(2, '0');
        const targetMin = targetDate.getMinutes().toString().padStart(2, '0');
        const timeCols = Array.from(picker.querySelectorAll('ion-col'));
        const separatorCol = timeCols.find(c => c.innerText.trim() === ":");
        if (separatorCol) {
            const hourContainer = separatorCol.previousElementSibling;
            const minContainer = separatorCol.nextElementSibling;
            if (hourContainer) { const hBtn = Array.from(hourContainer.querySelectorAll('ion-button')).find(b => b.innerText.trim() === targetHour); if (hBtn) clickElement(hBtn); }
            if (minContainer) { const mBtn = Array.from(minContainer.querySelectorAll('ion-button')).find(b => b.innerText.trim() === targetMin); if (mBtn) clickElement(mBtn); }
        }
        await wait(500);

        const confirmBtn = picker.parentElement.querySelector('ion-footer ion-button') || document.querySelector("ion-modal:last-of-type ion-footer ion-icon");
        if (confirmBtn) { if(confirmBtn.shadowRoot) confirmBtn.shadowRoot.querySelector("div")?.click(); else confirmBtn.click(); } 
        else { const icons = document.querySelectorAll('ion-icon[name="checkmark"]'); if(icons.length > 0) icons[icons.length-1].click(); }
        await wait(1000); 
    }

    const getPickerBtn = (nthChild, col) => {
        const path = \`#main-content > eventpage > ion-content > create-event > div > event-date-time:nth-child(\${nthChild}) > ion-list > ion-row > ion-col:nth-child(\${col}) > idea-date-time > ion-item\`;
        const el = document.querySelector(path);
        return el ? el.shadowRoot.querySelector("button > div.item-inner > div.input-wrapper") : null;
    };

    await handleDatePicker(getPickerBtn(3, 1), data.eventStart); 
    await handleDatePicker(getPickerBtn(3, 2), data.eventEnd);   
    await handleDatePicker(getPickerBtn(4, 1), data.registrationStart); 
    await handleDatePicker(getPickerBtn(4, 2), data.registrationEnd);   

    const tabRow = document.querySelector("#main-content > eventpage > ion-content > create-event > div > ion-row");
    if(tabRow) {
        clickElement(tabRow.children[0], "Tab IT"); await wait(200); await typeIntoEditor("md-editor .ace_content", data.descriptionIT);
        clickElement(tabRow.children[1], "Tab EN"); await wait(200); await typeIntoEditor("md-editor .ace_content", data.descriptionEN);
        if (data.descriptionES && tabRow.children[2]) { clickElement(tabRow.children[2], "Tab ES"); await wait(200); await typeIntoEditor("md-editor .ace_content", data.descriptionES); }
    }

    if (data.autoConfirm) clickElement(document.querySelector("ion-list:nth-child(7) ion-checkbox"), "Auto Confirm");

    const targetList = document.querySelector("ion-list:nth-child(8)");
    if(targetList) {
        const items = targetList.querySelectorAll('ion-item');
        if(data.alumniEnabled && items[2]) clickElement(items[2], "Alumni");
        if(data.exchangeStudentsEnabled && items[3]) clickElement(items[3], "Exchange");
        if(data.esnersEnabled && items[4]) clickElement(items[4], "ESNers");
        if(data.newbiesEnabled && items[5]) clickElement(items[5], "Newbies");
    }

    const capList = document.querySelector("ion-list:nth-child(9)");
    if(capList) {
        const inputs = capList.querySelectorAll("ion-input input");
        if(inputs[0]) setInputValue(inputs[0], data.maxParticipants);
        if(inputs[1]) setInputValue(inputs[1], data.maxWaitingList);
    }

    if (data.esnCardRequired) clickElement(document.querySelector("ion-list:nth-child(10) ion-checkbox"), "ESN Card");
    console.log("✅ Auto-fill complete!");
}
`;

// ==========================================
// 4. SERVER
// ==========================================

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // --- CORS Headers ---
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') return new Response(null, { headers });

    // --- ROUTE: Home (Frontend) ---
    if (
      req.method === 'GET' &&
      (url.pathname === '/' || url.pathname === '/index.html')
    ) {
      return new Response(file('public/index.html'));
    }

    // --- ROUTE: Generate Description (from src/index.ts) ---
    if (req.method === 'POST' && url.pathname === '/api/generate-description') {
      try {
        const body = await req.json();
        const result = DescSchema.safeParse(body);
        if (!result.success)
          return Response.json(
            { errors: result.error.format() },
            { status: 400, headers },
          );

        const data = result.data;
        let formattedPhone: string;
        try {
          formattedPhone = parsePhoneNumberWithError(
            data.contactPhone,
            DEFAULT_PHONE_COUNTRY,
          ).formatInternational();
        } catch {
          formattedPhone = data.contactPhone;
        }

        const generatedTemplates: Record<string, string> = {};
        (Object.keys(LOCALES) as Array<keyof typeof LOCALES>).forEach(
          (langKey) => {
            const config = LOCALES[langKey];
            const description = config.getDescription(data);
            if (!description) return;

            const dateEvent = formatDate(
              data.eventDate,
              config.locale,
              config.timeSeparator,
            );
            const dateReg = formatDate(
              data.registrationDeadline,
              config.locale,
              config.timeSeparator,
            );
            const datePay = formatDate(
              data.paymentDeadline,
              config.locale,
              config.timeSeparator,
            );
            const moneyFee = formatCurrency(data.fee, config.localeStr);

            const contentParts = [
              description,
              '',
              `- **${config.labels.when}:** ${dateEvent}\n- **${config.labels.where}:** ${data.location}\n- **${config.labels.fee}:** ${moneyFee}\n- **${config.labels.regDeadline}**: ${dateReg}`,
            ];

            if (data.fee > 0) {
              contentParts.push(
                `- **${config.labels.payDeadline}**: ${datePay}\n\n${config.labels.howToPayHeader}\n${config.labels.paymentInfo(data.contactName, data.eventName)}`,
              );
            }

            contentParts.push(
              '',
              `**${config.labels.fidelity}**: ${config.labels.fidelityFormat(data.fidelityPointsModena, data.fidelityPointsReggio)}`,
              '',
              `${config.labels.contact} **${data.contactName} ${formattedPhone}**`,
            );
            generatedTemplates[langKey] = contentParts.join('\n').trim();
          },
        );

        return Response.json(
          { success: true, data: generatedTemplates },
          { headers },
        );
      } catch (e) {
        return Response.json(
          { error: 'Server Error', details: String(e) },
          { status: 500, headers },
        );
      }
    }

    // --- ROUTE: Generate Script (from src/create-jupiter-event.ts) ---
    if (req.method === 'POST' && url.pathname === '/generate-script') {
      try {
        const body = await req.json();
        const configData = ScriptSchema.parse(body);
        const baseLogic = getCoreScript();
        const finalScript = `${baseLogic}\n\nconst config = ${JSON.stringify(configData, null, 2)};\nautoFillEventForm(config);`;

        return new Response(finalScript, {
          headers: { ...headers, 'Content-Type': 'text/javascript' },
        });
      } catch (error) {
        if (error instanceof z.ZodError)
          return Response.json(
            { error: 'Validation Error', details: error.issues },
            { status: 400, headers },
          );
        return Response.json(
          { error: 'Internal Server Error' },
          { status: 500, headers },
        );
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server running on ${server.url}`);
