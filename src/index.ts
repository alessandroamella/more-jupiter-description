import { enGB, it, type Locale } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import {
  isValidPhoneNumber,
  parsePhoneNumberWithError,
} from 'libphonenumber-js';
import { z } from 'zod';

// --- CONFIGURAZIONE ---
const TIMEZONE = 'Europe/Rome';
const DEFAULT_PHONE_COUNTRY = 'IT';

// --- VALIDAZIONE (Zod Schema) ---
const eventSchema = z.object({
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

// --- HELPER FUNCTIONS ---

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
    .replace(/\s/g, ''); // Remove any spaces (e.g., in "5 €")
};

// --- LANGUAGE CONFIGURATION ---
// This object makes it easy to add 'es', 'fr', etc. in the future.
type LanguageConfig = {
  locale: Locale;
  localeStr: string; // for currency formatting
  timeSeparator: string; // 'alle' vs 'at'
  getDescription: (data: z.infer<typeof eventSchema>) => string | null;
  labels: {
    when: string;
    where: string;
    fee: string;
    regDeadline: string;
    payDeadline: string; // Added label for payment deadline
    howToPayHeader: string;
    paymentInfo: (contactName: string, eventName: string) => string;
    fidelity: string;
    fidelityFormat: (modena: number, reggio: number) => string;
    contact: string;
  };
};

const LOCALES: Record<string, LanguageConfig> = {
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
      paymentInfo: (
        contactName,
        eventName,
      ) => `- tramite contanti o POS nel nostro ufficio a  [Modena](https://www.google.it/maps/place/Via+Ganaceto,+44,+41121+Modena+MO/@44.6483847,10.9220294,17z/data=!3m1!4b1!4m6!3m5!1s0x477fef13dd158f3d:0x51258ed00ccc5826!8m2!3d44.6483847!4d10.9246043!16s%2Fg%2F11c2bqmw_b?entry=ttu)
- tramite contanti nel nostro ufficio a [Reggio Emilia](https://www.google.it/maps/place/Via+Francesco+Cassoli,+1,+42123+Reggio+Emilia+RE/@44.6923692,10.6277506,17z/data=!3m1!4b1!4m6!3m5!1s0x47801c583ebe73b9:0x1c01d12d02d7a4fc!8m2!3d44.6923692!4d10.6303255!16s%2Fg%2F11c27s25pd?entry=ttu)
- tramite bonifico a questo IBAN (intestato a ESN Modena e Reggio Emilia - ETS): **IT36Q0200812930000104489759**
- tramite [Satispay](https://drive.google.com/file/d/1GKRau0IsgBg3NwJpse6g619l9l6jwFw0/view?usp=sharing), cercando "ESN Modena" sull'applicazione

Nel caso si paghi tramite bonifico/Satispay bisogna **INVIARE LA RICEVUTA AL RESPONSABILE** con la causale "*${contactName} - ${eventName}*"!

Per partecipare è obbligatorio iscriversi su Jupiter, e la conferma avverrà solo dopo il pagamento.`,
      fidelity: 'Fidelity Points',
      fidelityFormat: (modena, reggio) =>
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
      paymentInfo: (
        contactName,
        eventName,
      ) => `- by cash or POS at our office in [Modena](https://www.google.it/maps/place/Via+Ganaceto,+44,+41121+Modena+MO/@44.6483847,10.9220294,17z/data=!3m1!4b1!4m6!3m5!1s0x477fef13dd158f3d:0x51258ed00ccc5826!8m2!3d44.6483847!4d10.9246043!16s%2Fg%2F11c2bqmw_b?entry=ttu)
- by cash at our office in [Reggio Emilia](https://www.google.it/maps/place/Via+Francesco+Cassoli,+1,+42123+Reggio+Emilia+RE/@44.6923692,10.6277506,17z/data=!3m1!4b1!4m6!3m5!1s0x47801c583ebe73b9:0x1c01d12d02d7a4fc!8m2!3d44.6923692!4d10.6303255!16s%2Fg%2F11c27s25pd?entry=ttu)
- by bank transfer to this IBAN (holder -> ESN Modena e Reggio Emilia - ETS): **IT36Q0200812930000104489759**
- by [Satispay](https://drive.google.com/file/d/1GKRau0IsgBg3NwJpse6g619l9l6jwFw0/view?usp=sharing), searching for "ESN Modena" on the application

In case you pay by bank transfer/Satispay you have to **SEND THE RECEIPT TO THE RESPONSIBLE** with the reason "*${contactName} - ${eventName}*"!

To participate it's mandatory to register on Jupiter, and confirmation will only take place after payment.`,
      fidelity: 'Fidelity Points',
      fidelityFormat: (modena, reggio) =>
        `${modena} for Modena, ${reggio} for Reggio Emilia`,
      contact: '*For any problems or doubts please contact*:',
    },
  },
  // Future: Add 'es' here
};

// --- ENDPOINT AND SERVER ---
const PORT = 3000;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (
      req.method === 'POST' &&
      new URL(req.url).pathname === '/api/generate-description'
    ) {
      // 1. Validazione Input
      const body = await req.json();
      const result = eventSchema.safeParse(body);

      if (!result.success) {
        return Response.json(
          { errors: result.error.format() },
          {
            status: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
          },
        );
      }

      const data = result.data;

      // 2. Format Phone Number (Universal)
      let formattedPhone: string;
      try {
        const phoneParsed = parsePhoneNumberWithError(
          data.contactPhone,
          DEFAULT_PHONE_COUNTRY,
        );
        formattedPhone = phoneParsed.formatInternational();
      } catch {
        formattedPhone = data.contactPhone;
      }

      // 3. Generate Responses per Language
      const generatedTemplates: Record<string, string> = {};

      // Iterate over defined locales (it, en, ...)
      (Object.keys(LOCALES) as Array<keyof typeof LOCALES>).forEach(
        (langKey) => {
          // biome-ignore lint/style/noNonNullAssertion: c'è
          const config = LOCALES[langKey]!;

          const description = config.getDescription(data);
          if (description === null) return;

          // Data formatting specific to language
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

          // Build the Main Block
          // Note: Using \n\n for Markdown compatibility as requested
          const contentParts = [
            description,
            '', // Blank line for Markdown separation
            `- **${config.labels.when}:** ${dateEvent}
- **${config.labels.where}:** ${data.location}
- **${config.labels.fee}:** ${moneyFee}
- **${config.labels.regDeadline}**: ${dateReg}`,
          ];

          // Conditional Payment Block (Only if Fee > 0)
          if (data.fee > 0) {
            // Replace placeholders in the static text
            const specificPaymentInfo = config.labels.paymentInfo(
              data.contactName,
              data.eventName,
            );

            const paymentBlock = `- **${config.labels.payDeadline}**: ${datePay}

${config.labels.howToPayHeader}
${specificPaymentInfo}`;

            contentParts.push(paymentBlock);
          }

          // Footer Block
          contentParts.push(
            '', // Blank line for Markdown separation
            `**${config.labels.fidelity}**: ${config.labels.fidelityFormat(data.fidelityPointsModena, data.fidelityPointsReggio)}`,
            '', // Blank line for Markdown separation
            `${config.labels.contact} **${data.contactName} ${formattedPhone}**`,
          );

          // Join all parts with double newlines for clean Markdown separation
          generatedTemplates[langKey] = contentParts.join('\n').trim();
        },
      );

      // 4. Risposta
      // Returns keys like: { "it": "...", "en": "..." }
      return Response.json(
        {
          success: true,
          data: generatedTemplates,
        },
        {
          headers: { 'Access-Control-Allow-Origin': '*' },
        },
      );
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server ESN Generator running on ${server.url}`);
