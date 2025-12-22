import { api } from "./axiosInstance";

export async function processPipeline(arg1, arg2 = "generic") {
  let payload;

  // Controllo se il primo argomento è già il payload completo (contiene la chiave sensor_data)
  if (arg1.sensor_data) {
      payload = arg1;
  } else {
      payload = {
        sensor_data: arg1,
        plant_type: arg2,
      };
  }
  console.log("[API] Invio Pipeline:", payload);

  const { data } = await api.post("/api/pipeline/process", payload);
  return data;
}

/**
 * Endpoint semplificato per il suggerimento rapido.
 */
export async function getQuickSuggestion(sensorData, plantType = "generic") {
    // Utilizza process per coerenza e estrae i dati
    const fullResult = await processPipeline({
        sensor_data: sensorData,
        plant_type: plantType
    });
    
    return {
        status: fullResult.status,
        suggestion: fullResult.suggestion,
        metadata: fullResult.metadata
    };
}
