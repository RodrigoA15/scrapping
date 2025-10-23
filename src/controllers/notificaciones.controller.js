import puppeteer from "puppeteer";
import path from "path";
import fs from "node:fs";
import SambaClient from "samba-client";

// --- (Selectores y configuración de ruta sin cambios) ---
const SELECTORS = {
  usernameInput: "input[name='UserName']",
  passwordInput: "input[name='UserPass']",
  loginButton: "#Submit1",
  searchBox: "#ContentPlaceHolder1_TextBox0",
  searchButton: "#ContentPlaceHolder1_Button2",
  resultIndicator: ".c18",
  formPageIndicator: ".card-body",
};

const getEnvCredentials = () => {
  const { URL_INTRANET, USER_INTRANET, PASSWORD_INTRANET } = process.env;
  if (!URL_INTRANET || !USER_INTRANET || !PASSWORD_INTRANET) {
    throw new Error(
      "Faltan variables de entorno críticas (URL_INTRANET, USER_INTRANET, o PASSWORD_INTRANET)"
    );
  }
  return { url: URL_INTRANET, user: USER_INTRANET, pass: PASSWORD_INTRANET };
};

// --- Lógica de Scraping ---

/**
 * Orquesta todo el proceso de scraping.
 * @param {string[]} data - Array de items a procesar.
 */
const runScrapingProcess = async (data) => {
  const creds = getEnvCredentials();
  let browser = null;

  const results = {
    successCount: 0,
    failureCount: 0,
    failedItems: [],
  };

  const sambaOptions = {
    address: process.env.ADDRES_SAVE_ANSWERS,
    username: "",
    password: "",
    domain: "WORKGROUP",
    maxProtocol: "SMB3",
    maskCmd: true,
  };

  new SambaClient(sambaOptions);

  const currentDate = new Date();
  const year = currentDate.getFullYear().toString();

  const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
  const day = currentDate.getDate().toString().padStart(2, "0");

  const PDF_SAVE_PATH = path.join(
    "\\\\192.168.28.100",
    "\\Compartida",
    "\\programacion y datos",
    "\\RodrigoJR",
    year,
    month,
    day
  );

  try {
    fs.mkdirSync(PDF_SAVE_PATH, { recursive: true });
    console.log(`Directorio de PDF listo en: ${PDF_SAVE_PATH}`);
  } catch (error) {
    console.error(
      `Error crítico: No se pudo crear el directorio: ${error.message}`
    );
    // Si no se puede crear el directorio, no tiene sentido continuar.
    throw new Error(`Fallo al crear directorio: ${error.message}`);
  }

  try {
    browser = await puppeteer.launch({
      headless: false,
    });

    const page = await browser.newPage();
    await page.goto(creds.url);

    // --- Login ---
    await page.waitForSelector(SELECTORS.usernameInput, { visible: true });
    await page.type(SELECTORS.usernameInput, creds.user);
    await page.type(SELECTORS.passwordInput, creds.pass);
    await page.click(SELECTORS.loginButton);

    await page.waitForSelector(SELECTORS.formPageIndicator, { visible: true });
    console.log("Login exitoso. Iniciando procesamiento de items...");

    for (const item of data) {
      try {
        await processSingleItem(page, item, PDF_SAVE_PATH);

        results.successCount++;
        console.log(`ÉXITO: Item ${item} procesado.`);
      } catch (error) {
        // --- 3. Manejo de Error Individual ---
        // Si processSingleItem falla, se captura aquí
        console.error(
          `FALLO: No se pudo procesar el item ${item}. Error: ${error.message}`
        );
        results.failureCount++;
        results.failedItems.push(item);

        console.log(`Recuperando... Volviendo a la página del formulario.`);
        try {
          await page.goto(creds.url);
          await page.waitForSelector(SELECTORS.formPageIndicator, {
            visible: true,
          });
          console.log(
            "Recuperación exitosa. Continuando con el siguiente item."
          );
        } catch (recoveryError) {
          console.error(
            "FALLO CRÍTICO: No se pudo recuperar el estado de la página. Abortando..."
          );
          throw new Error(`Fallo de recuperación: ${recoveryError.message}`);
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Error crítico durante el proceso de scraping:", error);
    throw new Error(
      `El proceso de scraping falló críticamente: ${error.message}`
    );
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser cerrado correctamente.");
    }
  }
};

/**
 * Procesa un solo ítem.
 * @param {puppeteer.Page} page - La instancia de la página.
 * @param {string} item - El dato a procesar.
 * @param {string} savePath - La ruta base donde se guardará el PDF.
 */
const processSingleItem = async (page, item, savePath) => {
  // Espera, limpia y escribe
  await page.waitForSelector(SELECTORS.searchBox, {
    visible: true,
    timeout: 10000,
  });
  await page.click(SELECTORS.searchBox, { clickCount: 3 });
  await page.type(SELECTORS.searchBox, item, { delay: 50 });

  // Click y espera por el resultado
  await page.click(SELECTORS.searchButton);
  await page.waitForSelector(SELECTORS.resultIndicator, {
    visible: true,
    timeout: 10000,
  });

  const safeFilename = path.basename(String(item));

  const fullPath = path.join(savePath, `${safeFilename}.pdf`);

  await page.pdf({
    path: fullPath,
    format: "A4",
  });

  // Volver y esperar
  await page.goBack();
  await page.waitForSelector(SELECTORS.formPageIndicator, {
    visible: true,
    timeout: 10000,
  });
};

// --- Controlador de Express ---

export const generateNotifications = async (req, res) => {
  const { data } = req.body;

  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({
      message:
        "La propiedad 'data' es requerida y debe ser un arreglo no vacío.",
    });
  }

  try {
    // --- 5. Captura y Retorno de Resultados ---
    const results = await runScrapingProcess(data);

    const message = `Proceso completado. ${results.successCount} generados, ${results.failureCount} fallidos.`;

    // Devolvemos el reporte completo al cliente
    res.status(200).json({
      message: message,
      successCount: results.successCount,
      failureCount: results.failureCount,
      failedItems: results.failedItems,
    });
  } catch (error) {
    console.error("Error en generateNotifications:", error);
    res.status(500).json({
      message:
        "Ocurrió un error interno crítico al generar las notificaciones.",
      error: error.message, // Puedes omitir esto en producción
    });
  }
};
