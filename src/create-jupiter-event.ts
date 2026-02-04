import { z } from 'zod';

const PORT = process.env.PORT || 3000;

// 1. Define Zod Schema based on your config object
const EventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  placeName: z.string().min(1, 'Place name is required'),
  placeAddress: z.string().min(1, 'Address is required'),

  // Date validations
  eventStart: z.iso
    .datetime({ offset: true, message: 'Invalid ISO date' })
    .or(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, 'Format YYYY-MM-DD HH:mm'),
    ),
  eventEnd: z.iso
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)),
  registrationStart: z.iso
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)),
  registrationEnd: z.iso
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)),

  // Descriptions
  descriptionIT: z.string().default(''),
  descriptionEN: z.string().default(''),
  descriptionES: z.string().optional(),

  // Booleans
  autoConfirm: z.boolean().default(true),
  alumniEnabled: z.boolean().default(false),
  exchangeStudentsEnabled: z.boolean().default(true),
  esnersEnabled: z.boolean().default(true),
  newbiesEnabled: z.boolean().default(true),

  // Numbers
  maxParticipants: z.number().int().positive(),
  maxWaitingList: z.number().int().nonnegative(),

  esnCardRequired: z.boolean().default(true),
});

// type EventConfig = z.infer<typeof EventSchema>;

// 2. The Core Script Logic (Stored as a string function to avoid clutter)
// Note: We escape backticks (`) and dollar signs ($) if necessary,
// but since we are returning a raw string, we can just use a getter.
const getCoreScript = () => `
/**
 * AUTO FILL EVENT FORM SCRIPT (Generated)
 */

async function autoFillEventForm(data) {
    console.log("🚀 Starting Auto-fill process V2...");

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper: Set Value for Inputs
    const setInputValue = (domElement, value) => {
        if (!domElement) {
            console.warn(\`⚠️ Input element not found for value: "\${value}"\`);
            return;
        }
        domElement.value = value;
        domElement.dispatchEvent(new Event('input', { bubbles: true }));
        domElement.dispatchEvent(new Event('change', { bubbles: true }));
        domElement.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    // Helper: Click Element
    const clickElement = (domElement, label = "element") => {
        if (!domElement) {
            console.warn(\`⚠️ Click target [\${label}] not found.\`);
            return;
        }
        domElement.click();
    };

    // Helper: Type into Editor
    const typeIntoEditor = async (selector, text) => {
        const el = document.querySelector(selector);
        if (!el) return;
        clickElement(el, "Editor Focus");
        await wait(200);
        const success = document.execCommand('insertText', false, text);
        if (!success) {
            el.textContent = text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await wait(200);
    };

    // ---------------------------------------------------------
    // 1. NAME
    // ---------------------------------------------------------
    console.log("📝 Filling Name...");
    const titleEl = document.querySelector("textarea-component ion-input input") 
                 || document.querySelector("#main-content textarea-component input");
    setInputValue(titleEl, data.title);

    // ---------------------------------------------------------
    // 2. PLACE / LOCATION
    // ---------------------------------------------------------
    console.log("📍 Filling Location...");
    const addressInputs = document.querySelectorAll("address-event ion-input input");
    
    if (addressInputs.length >= 2) {
        setInputValue(addressInputs[0], data.placeName);    
        setInputValue(addressInputs[1], data.placeAddress); 
    } else {
        console.error("❌ Could not find Address inputs. Check DOM.");
    }

    // ---------------------------------------------------------
    // 3. DATE PICKER LOGIC
    // ---------------------------------------------------------
    const italianMonths = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

    async function handleDatePicker(triggerElement, dateStr) {
        if (!triggerElement) {
            console.error("❌ Date trigger element not found.");
            return;
        }

        const targetDate = new Date(dateStr);
        let min = targetDate.getMinutes();
        const remainder = min % 5;
        if (remainder !== 0) min += (5 - remainder);
        targetDate.setMinutes(min);

        triggerElement.click();
        await wait(800); 

        const pickers = document.querySelectorAll('idea-calendar-picker');
        const picker = pickers[pickers.length - 1]; 
        if (!picker) { console.error("❌ Calendar picker not open."); return; }

        // A. SET YEAR
        const yearInput = picker.querySelector('input[placeholder="Anno"]');
        if (yearInput) {
            yearInput.value = targetDate.getFullYear();
            yearInput.dispatchEvent(new Event('input', { bubbles: true }));
            await wait(300);
        }

        // B. SET MONTH
        const allCols = Array.from(picker.querySelectorAll('ion-col'));
        let monthCol = null;
        for(let col of allCols) {
            if(italianMonths.includes(col.innerText.trim().toLowerCase())) {
                monthCol = col;
                break;
            }
        }

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

        // C. SET DAY
        const targetDay = targetDate.getDate().toString();
        const btns = Array.from(picker.querySelectorAll('ion-button'));
        for(let btn of btns) {
            if(btn.innerText.trim() === targetDay) {
                clickElement(btn, \`Day \${targetDay}\`);
                break;
            }
        }
        await wait(500);

        // D. SET TIME
        const targetHour = targetDate.getHours().toString().padStart(2, '0');
        const targetMin = targetDate.getMinutes().toString().padStart(2, '0');
        
        const timeCols = Array.from(picker.querySelectorAll('ion-col'));
        const separatorCol = timeCols.find(c => c.innerText.trim() === ":");

        if (separatorCol) {
            const hourContainer = separatorCol.previousElementSibling;
            const minContainer = separatorCol.nextElementSibling;

            if (hourContainer) {
                const hourButtons = Array.from(hourContainer.querySelectorAll('ion-button'));
                const hBtn = hourButtons.find(b => b.innerText.trim() === targetHour);
                if (hBtn) clickElement(hBtn, \`Hour \${targetHour}\`);
            }

            if (minContainer) {
                const minButtons = Array.from(minContainer.querySelectorAll('ion-button'));
                const mBtn = minButtons.find(b => b.innerText.trim() === targetMin);
                if (mBtn) clickElement(mBtn, \`Minute \${targetMin}\`);
            }
        }
        
        await wait(500);

        // E. CONFIRM
        const confirmBtn = picker.parentElement.querySelector('ion-footer ion-button') 
                        || document.querySelector("ion-modal:last-of-type ion-footer ion-icon");
        
        if (confirmBtn) {
            if(confirmBtn.shadowRoot) confirmBtn.shadowRoot.querySelector("div")?.click();
            else confirmBtn.click();
        } else {
            const icons = document.querySelectorAll('ion-icon[name="checkmark"]');
            if(icons.length > 0) icons[icons.length-1].click();
        }
        
        await wait(1000); 
    }

    // --- EXECUTE FIELDS ---

    const getPickerBtn = (nthChild, col) => {
        const path = \`#main-content > eventpage > ion-content > create-event > div > event-date-time:nth-child(\${nthChild}) > ion-list > ion-row > ion-col:nth-child(\${col}) > idea-date-time > ion-item\`;
        const el = document.querySelector(path);
        return el ? el.shadowRoot.querySelector("button > div.item-inner > div.input-wrapper") : null;
    };

    await handleDatePicker(getPickerBtn(3, 1), data.eventStart); 
    await handleDatePicker(getPickerBtn(3, 2), data.eventEnd);   
    await handleDatePicker(getPickerBtn(4, 1), data.registrationStart); 
    await handleDatePicker(getPickerBtn(4, 2), data.registrationEnd);   

    // Descriptions
    console.log("📝 Filling Descriptions...");
    const tabRow = document.querySelector("#main-content > eventpage > ion-content > create-event > div > ion-row");
    if(tabRow) {
        clickElement(tabRow.children[0], "Tab IT");
        await wait(200);
        await typeIntoEditor("md-editor .ace_content", data.descriptionIT);

        clickElement(tabRow.children[1], "Tab EN");
        await wait(200);
        await typeIntoEditor("md-editor .ace_content", data.descriptionEN);

        if (data.descriptionES && tabRow.children[2]) {
            clickElement(tabRow.children[2], "Tab ES");
            await wait(200);
            await typeIntoEditor("md-editor .ace_content", data.descriptionES);
        }
    }

    // Toggles
    if (data.autoConfirm) {
        clickElement(document.querySelector("ion-list:nth-child(7) ion-checkbox"), "Auto Confirm");
    }

    const targetList = document.querySelector("ion-list:nth-child(8)");
    if(targetList) {
        const items = targetList.querySelectorAll('ion-item');
        if(data.alumniEnabled && items[2]) clickElement(items[2], "Alumni");
        if(data.exchangeStudentsEnabled && items[3]) clickElement(items[3], "Exchange");
        if(data.esnersEnabled && items[4]) clickElement(items[4], "ESNers");
        if(data.newbiesEnabled && items[5]) clickElement(items[5], "Newbies");
    }

    // Capacity
    console.log("🔢 Setting Capacity...");
    const capList = document.querySelector("ion-list:nth-child(9)");
    if(capList) {
        const inputs = capList.querySelectorAll("ion-input input");
        if(inputs[0]) setInputValue(inputs[0], data.maxParticipants);
        if(inputs[1]) setInputValue(inputs[1], data.maxWaitingList);
    }

    // ESN Card
    if (data.esnCardRequired) {
        clickElement(document.querySelector("ion-list:nth-child(10) ion-checkbox"), "ESN Card");
    }

    console.log("✅ Auto-fill complete!");
}
`;

// 3. API Endpoint and Server
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
      new URL(req.url).pathname === '/generate-script'
    ) {
      try {
        // Validate request body
        const body = await req.json();
        const configData = EventSchema.parse(body);

        // Get the base logic
        const baseLogic = getCoreScript();

        // Construct the final Javascript
        // We inject the validated JSON as a string into the script
        const finalScript = `
${baseLogic}

// ==========================================
// DYNAMIC CONFIGURATION (FROM SERVER)
// ==========================================
const config = ${JSON.stringify(configData, null, 2)};

// Run
autoFillEventForm(config);
        `;

        // Return as text/javascript
        return new Response(finalScript, {
          headers: {
            'Content-Type': 'text/javascript',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return Response.json(
            { error: 'Validation Error', details: error.issues },
            {
              status: 400,
              headers: { 'Access-Control-Allow-Origin': '*' },
            },
          );
        }
        return Response.json(
          { error: 'Internal Server Error' },
          {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
          },
        );
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`⚡️ Script Generator Server running on ${server.url}`);
