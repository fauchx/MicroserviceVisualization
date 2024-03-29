//************* Imports *****************/
import React from 'react';
import * as go from 'gojs';
import '../node_modules/gojs/extensions/Figures'
import { Inspector } from '../node_modules/gojs/extensionsJSM/DataInspector.js'
import './css/App.css';  // contains .diagram-component CSS
import swal from 'sweetalert'
import schema from "./schemas/microservices.json";
import {API_URL} from "./utils";
import Swal from 'sweetalert2'

//************ Variables ****************/

var myDiagram;
var nodos = [];
var aristas = [];
var diagramaCargado = false;
var json;
var userStory = [];
var proximoMS = "";
var CantidadMSs = 0;
var proyecto = "";
var arraySS = [];
var nueva_config = false;

var AIST = 0; // Acoplamiento AIS total
var ADST = 0; // Acoplamiento ADS total
var SIYT = 0; // Acoplamiento SIY total

var Coh = 0;  // Cohesion grade total

/* Cx = (sum(c𝑔)) + maxMSpoints + (CantidadMSs*WsicT) + (sum(Pf)) + (sum(SIY)) */
var maxMSpoints = 0;
var Cx = 0;
var sumCg = 0; // Cg = P(i) * (calls(i) + requests(i)) de un microservicio
var sumPf = 0; // Pf = Profundidad máxima de llamadas secuenciales de un microservicio
var sumSIY = 0;

/* CxT = Cx / Cxo */

//   𝑀𝑇 ⃗=[10 𝐶𝑝𝑇, 𝐶𝑜ℎ𝑇, 𝑊𝑠𝑖𝑐𝑇, 𝐶𝑥𝑇,(100− 𝑆𝑠𝑇)]
var CpT = 0;  // Acoplamiento total de la aplicación
var CohT = 0; // Cohesión total de la aplicación
var WsicT = 0;// mayor número de historias de usuario asociadas a un microservicio
var CxT = 0;  // Complejidad cognitiva total de la aplicación
var SsT = 0;  // Similitud semántica total de la aplicación

// Gm = |𝑀𝑇 ⃗|
var Gm = 0;

/*
𝑀𝑆𝐵𝐴=(𝑀𝑆, 𝑀𝑇 ⃗)  
Donde:
𝑀𝑆𝐵𝐴 = MicroServices Based Application
MS es un conjunto de microservicios MS = {ms1, ms2, …, msn} 
𝑀𝑇 ⃗ es un vector de métricas calculadas para MSBA
*/

//************ Funciones ****************/

function recibe_parametro(props) {
  const query = new URLSearchParams(props.target.location.search);
  const diagrama = query.get('diagrama');

  console.log("Diagrama:", diagrama);

  if (diagrama !== null) {
    swal({
      title: "Loading stories",
      icon: "success",
    });
    console.log(diagrama)
    try {
          json = JSON.parse(diagrama);
          var schema = require('./schemas/microservices.json');
          var esValido = validarJson(schema, json);

          console.log("Validation Result:", esValido);

          if (esValido) {
            nuevoDiagrama(true);
            swal.close();
          }
        }
     catch (err) {
      console.error("Try-Catch Error:", err);
      swal({
        title: "" + err,
        text: "Error",
        icon: "error",
      });
    }
  }   
 }

function profundidadMax(nodos2, nombreMS) {
  var matriz = [[nombreMS]];
  var prof = [0]; // ïndice de profundidad del nodo a expandir
  var padre = [];
  var resultado = 0; // Variable para retornar la complejidad cognitiva
  while (matriz.length > 0) { // Algoritmo de búsqueda por Amplitud
    padre = matriz[0]; // padre = arreglo de MS's
    nombreMS = padre[prof[0]] // Nombre del MS a buscar las dependencias
    for (let i = 0; i < nodos2.length; i++) { // Recorre todos los nodos
      if (nodos2[i].id === nombreMS) { // Encuentra el MS a expandir sus dependencias
        var depend = nodos[i]["Dependencies"]; // Arreglo de dependencias
        for (let k = 0; k < depend.length; k++) { // Recorre las dependencias
          if (padre[prof[0]] !== depend[k]) { // Si el MS a expandir es diferente de las dependencias
            var noEsta = true;
            // for para comparar los MSs de padre y evitar devolverse a un nodo anterior
            for (let l = 0; l < padre.length; l++) {
              if (padre[l] === depend[k]) {
                noEsta = false;
              }
            }
            if (noEsta) {
              var hijo = padre; // Clona el array de MSs padre
              hijo = hijo.concat(depend[k]); // Le agrega el MSs que no está en el arreglo
              matriz = matriz.concat(new Array(hijo)); // Agregar un nuevo arreglo (nodo) a la matriz
              prof = prof.concat(prof[0] + 1) // Agrega la profundidad del nuevo nodo
            }
          }
        }
        break;
      }
    }
    resultado = matriz[0].length - 1; // Cambia su valor hasta quedarse con el máximo
    matriz.shift(); // Quita el primer elemento (expandido) de la matriz
    prof.shift(); // Quita la profundidad del elemento recién quitado de la matriz
  }
  return resultado;
}

async function similitud_semantica(nombres_HU) {
  var resultado = "";
  var cadena = nombres_HU[0];
  var similitudSemantica = [];
  for (let i = 1; i < nombres_HU.length; i++) {
    cadena = cadena + "*" + nombres_HU[i];
  }
  const encodedValue = encodeURIComponent(cadena);
  var showLoading = function () {
    Swal.fire({
      title: 'Calculating...',
      width: 300,
      allowOutsideClick: false,
      showConfirmButton: false,
      willOpen: () => {
        Swal.showLoading()
      },
    });
  }
  showLoading();
  await new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("user_stories", encodedValue)

    fetch(`${API_URL}/`, {
      method: "POST",
      body: formData,
    }).then(function (response) {
      setTimeout(() => {
        resolve(response)
      }, 50);
      return response.json();
    }).then(json => {
      resultado = json;
      similitudSemantica = resultado.semantic_similarity
    }).catch(function (err) {
      swal({
        title: "" + err,
        width: 100,
        text: "Error",
        icon: "error",
        timer: 5000
      })
      diagramaCargado = false;
    })
  });
  Swal.close();
  return similitudSemantica;
}

async function consultarBD() {
  await new Promise((resolve, reject) => {
    fetch(`${API_URL}/`, {
      method: "POST",
      body: JSON.stringify(json),
      headers: {
        "Content-Type": "application/json"
      },
    }).then(function (response) {
      setTimeout(() => {
        resolve(response)
      }, 50);
      return response.json();
    }).then(resultado => {
      if (resultado.nueva_config === true) {
        nueva_config = true;
        return true;
      } else {
        json = JSON.parse(resultado.configuracion);
        nueva_config = false;
        return false;
      }
    }).catch(function (err) {
      swal({
        title: "" + err,
        text: "Error",
        icon: "error",
        timer: 5000
      })
      diagramaCargado = false;
    })
  });
}
// Esta lógica puede servir para mantener un array de configuraciones para comparar resultados
// function consultarBD() {
//   var cadena_historias = ""; // Para almacenar todos las IDs de HUs de un MS en un string
//   var historia_sin_guion = ""; // Variable que guardará el ID de la HU sin guión  

//   var nombre_proyecto = json[0].userStories[0].project;
//   var cantidad_MSs = json.length;
//   var cantidad_HUs = 0;

//   var arreglo_stringsHUs = []; // Arrreglo de strings de historias para cada MS
//   var arreglo_historias = []; // Arreglos temporales de historias de cada MS
//   for (let i = 0; i < Object(json).length; i++) { // Iteración para cada microservicio
//     cantidad_HUs = cantidad_HUs + Object(json[i].userStories).length;
//     cadena_historias = ""; // Todas las historias de un microservicio en un string
//     for (let j = 0; j < Object(json[i].userStories).length; j++) {
//       historia_sin_guion = json[i].userStories[j].id.replace("US-", "")
//       cadena_historias = cadena_historias + historia_sin_guion + ","; // Concatena IDs de HUs en string
//     }
//     formatear_strings_HU();
//     arreglo_stringsHUs = arreglo_stringsHUs.concat(cadena_historias); // Agrega el string de IDs de HUs al arreglo
//   }

//   function formatear_strings_HU() {
//     cadena_historias = cadena_historias.substring(0, cadena_historias.length - 1);
//     arreglo_historias = cadena_historias.split(',');
//     // arreglo_historias = arreglo_historias.sort();
//     var nums = arreglo_historias.map(function (str) { // Convertir arreglo de strings a nummeros
//       return parseInt(str);
//     });
//     nums = nums.sort(function (a, b) {
//       return a - b;
//     });
//     arreglo_historias = nums.map(function (str) {
//       // using map() to convert array of strings to numbers
//       return "US" + str;
//     });
//     cadena_historias = ""
//     for (let j = 0; j < arreglo_historias.length; j++) {
//       cadena_historias = cadena_historias + arreglo_historias[j] + ","; // Concatena IDs de HUs en string
//     }
//     cadena_historias = cadena_historias.substring(0, cadena_historias.length - 1);
//   }

//   /////////////////////// Hacer las consultas en base de datos ////////////////////////////////////////  
//   var consulta = "SELECT * FROM tabla-1 WHERE nombre = " + nombre_proyecto + " AND microservicios = " + cantidad_MSs + " AND historias = ," + cantidad_HUs;
//   var registros = ejecutar_consulta(consulta);
//   var arreglo_stringsHUsBD = []; // Array de string de historias para cada MS
//   //for (let i = 0; i < registros.length; i++) {
//   for (let i = 0; i < 1; i++) {
//     consulta = "SELECT * FROM tabla-2 WHERE tabla-1-id = " + registros[i].id
//     arreglo_stringsHUsBD = ejecutar_consulta(consulta);
//     var coincidencias_MSs = 0;
//     for (let i = 0; i < arreglo_stringsHUs.length; i++) {
//       for (let j = 0; j < arreglo_stringsHUsBD.length; j++) {
//         if (arreglo_stringsHUs[i] === arreglo_stringsHUsBD[j]) {
//           coincidencias_MSs += 1;
//         }
//       }
//     }
//     if (coincidencias_MSs === cantidad_MSs) {
//       console.log("Si es el mismo")
//       // json = JSON.parse(registros[i].archivo); // Trae el JSON
//       // nuevoDiagrama(false);
//       return;
//     }
//   }

//   ///////////////////// Si es falso se guarda la configuración en la base de datos /////////////////////////
//   consulta = "INSERT INTO tabla-1 VALUES(" + nombre_proyecto + "," + cantidad_MSs + "," + cantidad_HUs + "," + JSON.stringify(json) + ")";
//   var registro_id = ejecutar_consulta(consulta);
//   for (let i = 0; i < cantidad_MSs.length; i++) {
//     consulta = "INSERT INTO tabla-2 VALUES(" + registro_id + "," + json[i].id + "," + arreglo_stringsHUs[i] + ")"
//     ejecutar_consulta(consulta);
//   }
//   ////////////////////////////////////////////////////////////////////////////////////////////////////////////

//   console.log("No es el mismo")
//   return;
// }

async function convertir_jsonAnodos(recalcular, recalcularSS, diagramar) {
  proyecto = json[0].userStories[0].project;
  arraySS = [];
  AIST = 0;
  ADST = 0;
  SIYT = 0;
  CpT = 0;
  Coh = 0;
  CohT = 0;
  WsicT = 0;
  SsT = 0;
  CantidadMSs = 0;
  maxMSpoints = 0;
  CxT = 0;
  Cx = 0;
  sumCg = 0;
  sumPf = 0;
  sumSIY = 0;
  Gm = 0;
  nodos = [];
  aristas = [];
  var arrayNombresHU = [];

  for (let i = 0; i < Object(json).length; i++) {
    json[i].id = json[i].id.replace("-", "");
    var MSdependencias = [];
    var MScalls = [];
    var MSpuntos = 0;
    var nombresHU = "";
    for (let j = 0; j < Object(json[i].userStories).length; j++) {
      var USdependencias = [];
      var UScalls = [];
      json[i].userStories[j].id = json[i].userStories[j].id.replace("-", "");
      json[i].userStories[j].name = json[i].userStories[j].name.replace("/", " ");
      json[i].userStories[j].name = json[i].userStories[j].name.replace("*", " ");
      nombresHU = nombresHU + json[i].userStories[j].name + " " + json[i].userStories[j].description + "/";
      MSpuntos = MSpuntos + json[i].userStories[j].points;
      if (Object(json[i].userStories).length > WsicT) {
        WsicT = Object(json[i].userStories).length;
      };
      for (let k = 0; k < Object(json[i].userStories[j].dependencies).length; k++) {
        json[i].userStories[j].dependencies[k].id = json[i].userStories[j].dependencies[k].id.replace("-", "");
        aristas = aristas.concat({
          from: json[i].id,
          // eslint-disable-next-line
          to: (function () {
            for (let l = 0; l < Object(json).length; l++) {
              for (let m = 0; m < Object(json[l].userStories).length; m++) {
                json[l].userStories[m].id = json[l].userStories[m].id.replace("-", "");
                if (json[i].userStories[j].dependencies[k].id === json[l].userStories[m].id) {
                  UScalls = UScalls.concat(json[i].userStories[j].dependencies[k].id);
                  if (json[i].id !== json[l].id) { // Si son diferentes MS's se asigna el valor a 'to'.
                    json[l].id = json[l].id.replace("-", "");
                    MScalls = MScalls.concat(json[l].id);
                    return json[l].id;
                  }
                }
              }
            }
          })()
        });
      }
      /* Hacer este filter abajo si se quieren mostrar las dependencias repetidas en el Inspector*/
      // eslint-disable-next-line
      USdependencias = UScalls.filter((item, index) => {// Quita las dependencias repetidas
        return UScalls.indexOf(item) === index;
      })
      nodos = nodos.concat({
        "Actor": json[i].userStories[j].actor,
        "componente": "historia",
        "Dependencies": USdependencias,
        "group": json[i].id,
        "id": json[i].userStories[j].id,
        "key": json[i].userStories[j].id,
        "Name": json[i].userStories[j].name,
        "Description": json[i].userStories[j].description,
        "Priority": json[i].userStories[j].priority,
        "project": json[i].userStories[j].project,
        "Points": json[i].userStories[j].points
      });
    }

    nombresHU = nombresHU.substring(0, nombresHU.length - 1); // Quita el último '/' de la cadena
    arrayNombresHU = arrayNombresHU.concat([nombresHU]);

    /* Hacer este filter abajo si se quieren mostrar las dependencias repetidas en el Inspector*/
    // eslint-disable-next-line
    MSdependencias = MScalls.filter((item, index) => {// Quita las dependencias repetidas
      return MScalls.indexOf(item) === index;
    })

    if (json[i].userStories.length !== 0) {
      CantidadMSs++;
      if (recalcular) {
        nodos = nodos.concat({
          "calls": MScalls.length,
          "cg": 0,
          "Cohesion Lack": 0,
          "Cohesion Grade": 0,
          "Coupling ADS": MSdependencias.length,
          "Coupling AIS": 0,
          "Coupling SIY": 0,
          "columnas": Math.ceil(Math.sqrt(json[i].userStories.length)),
          "Complexity": MSpuntos.toFixed(2),
          "componente": "microservicio",
          "Dependencies": MSdependencias, // o 'MScalls' si quiere mostrar repetidos 
          "isGroup": true,
          "id": json[i].id,
          "key": json[i].id,
          "Points": MSpuntos,
          "requests": 0,
          "Semantic Similarity": json[i].semanticSimilarity,
          // eslint-disable-next-line
          "size": (function () {
            if (document.getElementById('stories').checked) {
              return 45 + (json[i].userStories.length * 12);
            } else {
              //return 45 + (MSpuntos * 12);
              return 40 + MSpuntos + (json[i].userStories.length * 12);
            }
          })(),
          "textoID": 0.23 - ((((45 + (json[i].userStories.length * 12)) - 57) * 0.12) / 100),
          "userStories": json[i].userStories.length,
          "WSIC": json[i].userStories.length
        });
      } else {
        nodos = nodos.concat({
          "calls": MScalls.length,
          "cg": 0,
          "Cohesion Lack": json[i].cohesionLack,
          "Cohesion Grade": json[i].cohesionGrade,
          "Coupling ADS": json[i].couplingADS,
          "Coupling AIS": json[i].couplingAIS,
          "Coupling SIY": json[i].couplingSIY,
          "columnas": Math.ceil(Math.sqrt(json[i].userStories.length)),
          "Complexity": json[i].complexity,
          "componente": "microservicio",
          "Dependencies": MSdependencias, // o 'MScalls' si quiere mostrar repetidos 
          "isGroup": true,
          "id": json[i].id,
          "key": json[i].id,
          "Points": json[i].points,
          "requests": 0,
          "Semantic Similarity": json[i].semanticSimilarity,
          // eslint-disable-next-line
          "size": (function () {
            if (document.getElementById('stories').checked) {
              return 45 + (json[i].userStories.length * 12);
            } else {
              //return 45 + (MSpuntos * 12);
              return 40 + MSpuntos + (json[i].userStories.length * 12);
            }
          })(),
          "textoID": 0.23 - ((((45 + (json[i].userStories.length * 12)) - 57) * 0.12) / 100),
          "userStories": json[i].userStories.length,
          "WSIC": json[i].userStories.length
        });
      }
    }
    ADST = ADST + Math.pow(MSdependencias.length, 2) // Sumatoria de los cuadrados
  };

  if (recalcular & recalcularSS) {
    arraySS = await similitud_semantica(arrayNombresHU);
  }

  calcularMetricas(recalcular, recalcularSS, diagramar);
}

function calcularMetricas(recalcular, recalcularSS, diagramar) {
  // Quitar las aristas con 'to' undefined
  aristas = aristas.filter((item) => item.to !== undefined);

  var rendimiento = 0;
  var contadorSS = 0;

  // Cálculo de los acomplamientos AIS y SIY
  for (let i = 0; i < nodos.length; i++) {
    if (nodos[i].componente === "microservicio") {
      var LC = CantidadMSs - 1; // Cohesion Lack

      // Cálculo de los requests (Cantidad de aristas que le entran)
      var MSrequests = [];
      var MSimportancia = [];
      for (let j = 0; j < aristas.length; j++) {
        if (nodos[i].id === aristas[j].to) {
          MSrequests = MSrequests.concat(aristas[j].from);
        }
      }
      // eslint-disable-next-line
      MSimportancia = MSrequests.filter((item, index) => {// Quita las importancias
        return MSrequests.indexOf(item) === index;      // repetidas
      })
      nodos[i].requests = MSrequests.length;
      if (recalcular) {
        nodos[i]["Coupling AIS"] = MSimportancia.length;
      }
      AIST = AIST + Math.pow(nodos[i]["Coupling AIS"], 2); // Sumatoria de los cuadrados

      if (recalcular) {
        // Cálculo del acomplamiento SIY (interdependencias / cantidad de MS's)
        var interdependencias = [];
        // eslint-disable-next-line
        var interdepA = nodos[i]["Dependencies"].filter((item, index) => {// Quita las depen-
          return nodos[i]["Dependencies"].indexOf(item) === index;// dencias(1) repetidas
        })
        for (let j = 0; j < interdepA.length; j++) { // para comparar cada dependencia(1)
          for (let k = 0; k < nodos.length; k++) { // Inicia de nuevo en todos los nodos
            if (nodos[k].componente === "microservicio") { // solo los nodos MS's
              // eslint-disable-next-line
              var interdepB = nodos[k]["Dependencies"].filter((item, index) => {
                return nodos[k]["Dependencies"].indexOf(item) === index;
              }) // Quita las dependencias(2) repetidas
              if (interdepA[j] === nodos[k].id) { // Compara dependencias(1) con IDs de MS
                for (let l = 0; l < interdepB.length; l++) {
                  if (interdepB[l] === nodos[i].id) { // Compara dependencias(2) con IDs de MS
                    interdependencias = interdependencias.concat(nodos[k].id);
                    LC--;
                  }
                }
              }
            }
          }
        }
      }
      var SIY = 0;
      if (recalcular) {
        SIY = (interdependencias.length / CantidadMSs)
        nodos[i]["Coupling SIY"] = SIY.toFixed(2);

        // Cálculo de Cohesion Lack  y Grade
        nodos[i]["Cohesion Lack"] = LC;
        Coh = LC / CantidadMSs;
        nodos[i]["Cohesion Grade"] = Coh.toFixed(2);

        if (recalcularSS) {
          nodos[i]["Semantic Similarity"] = arraySS[contadorSS];
          contadorSS++;
        }
      } else {
        SIY = (nodos[i]["Coupling SIY"])

        // Cálculo de CohT
        Coh = nodos[i]["Cohesion Lack"] / CantidadMSs;
      }
      SIYT = SIYT + Math.pow(SIY, 2); // Sumatoria de los cuadrados

      CohT = CohT + Math.pow(Coh, 2); // Sumatoria de los cuadrados

      SsT = SsT + nodos[i]["Semantic Similarity"] // Sumatoria previa

      // Se formatea el valor de la similitud semántica para expresarle en términos porcentuales
      if (recalcular) {
        if (!diagramar) {
          nodos[i]["Semantic Similarity"] = nodos[i]["Semantic Similarity"] / 100
        }
        nodos[i]["Semantic Similarity"] = "" + (100 * nodos[i]["Semantic Similarity"]).toFixed(2) + "%";
      } else {
        nodos[i]["Semantic Similarity"] = nodos[i]["Semantic Similarity"].toFixed(2) + "%";
      }

      /*        Otros         */
      rendimiento = rendimiento + nodos[i].calls;
      // cg = MSpuntos * (MScalls + MSrequests)
      nodos[i].cg = nodos[i]["Points"] * (nodos[i].calls + MSrequests.length);
      console.log(nodos[i].id + ".cg: " + nodos[i].cg.toFixed(2));
      //
      if (nodos[i]["Points"] > maxMSpoints) {
        maxMSpoints = nodos[i]["Points"];
      }

      // Cálculo de las variables para calcular la complejidad cognitiva CxT
      var profundidad = profundidadMax(nodos, nodos[i].id);
      console.log(nodos[i].id + ".prof: " + profundidad);
      sumPf = sumPf + profundidad;
      sumCg = sumCg + nodos[i].cg;
      sumSIY = sumSIY + SIY;
    }
  }

  // Cx = (sum(c𝑔)) + maxMSpoints + (CantidadMSs*WsicT) + (sum(Pf)) + (sum(SIY)) 
  Cx = sumCg + maxMSpoints + (CantidadMSs * WsicT) + sumPf + sumSIY
  CxT = Cx / 2;

  // Sacar las raíces de las sumatorias
  AIST = Math.sqrt(AIST);
  ADST = Math.sqrt(ADST);
  SIYT = Math.sqrt(SIYT);
  CpT = Math.sqrt(Math.pow(AIST, 2) + Math.pow(ADST, 2) + Math.pow(SIYT, 2));
  CohT = Math.sqrt(CohT);
  if (recalcular) {
    SsT = SsT * (100 / CantidadMSs);
  } else {
    SsT = SsT * (1 / CantidadMSs);
  }

  // 𝑀𝑇 ⃗=[𝐶𝑝𝑇, 𝐶𝑜ℎ𝑇, 𝑊𝑠𝑖𝑐𝑇, 𝐶𝑥𝑇,(100 − 𝑆𝑠𝑇)]
  // Gm = |𝑀𝑇 ⃗|
  Gm = Math.sqrt(Math.pow((10 * CpT), 2) + Math.pow(CohT, 2) + Math.pow(WsicT, 2) + Math.pow(CxT, 2) + Math.pow((100 - SsT), 2));

  /*          Otros           */
  rendimiento = rendimiento / CantidadMSs;
  // console.log("  *** OTRAS MÉTRICAS DE LA APLICACIÓN ***")
  console.log("AIST: " + AIST.toFixed(2));
  console.log("ADST: " + ADST.toFixed(2));
  console.log("SIYT: " + SIYT.toFixed(2));
  console.log("Rendimiento: " + rendimiento.toFixed(2));
  console.log("Max MS points: " + maxMSpoints.toFixed(2));
  console.log("Suma de profundidades: " + sumPf.toFixed(2));
  console.log("Suma de Cg: " + sumCg.toFixed(2));
  console.log("Suma de SIY: " + sumSIY.toFixed(2));
  console.log("Cx: " + Cx.toFixed(2));

  diagramaCargado = true;
  if (diagramar) {
    init();
  }
}

function convertir_nodosAjson(nodosAjson) {
  json = [];
  var microservicios = [];
  microservicios = nodosAjson.filter((item) => item.componente === 'microservicio')

  for (let h = 0; h < microservicios.length; h++) {
    const hu = nodosAjson.filter((item) => (
      item.componente === 'historia' && item.group === microservicios[h]["key"]
    ))
    var huCopia = JSON.stringify(hu);
    huCopia = JSON.parse(huCopia);
    // Convertir el array de dependencias de tipo string a tipo objeto
    for (let i = 0; i < hu.length; i++) {
      var dependenciasFormateadas = [];
      for (let j = 0; j < huCopia[i]["Dependencies"].length; j++) {
        dependenciasFormateadas = dependenciasFormateadas.concat({
          id: huCopia[i]["Dependencies"][j]
        });
      }
      huCopia[i]["dependencies"] = dependenciasFormateadas;
      delete huCopia[i]["Dependencies"];
      huCopia[i]["points"] = huCopia[i]["Points"];
      delete huCopia[i]["Points"];
      huCopia[i]["actor"] = huCopia[i]["Actor"];
      delete huCopia[i]["Actor"];
      huCopia[i]["name"] = huCopia[i]["Name"];
      delete huCopia[i]["Name"];
      huCopia[i]["description"] = huCopia[i]["Description"];
      delete huCopia[i]["Description"];
      huCopia[i]["priority"] = huCopia[i]["Priority"];
      delete huCopia[i]["Priority"];
    }
    microservicios[h]["Semantic Similarity"] = microservicios[h]["Semantic Similarity"].replace("%", "");
    json = json.concat({
      "cohesionLack": microservicios[h]["Cohesion Lack"],
      "cohesionGrade": Number(microservicios[h]["Cohesion Grade"]),
      "couplingADS": microservicios[h]["Coupling ADS"],
      "couplingAIS": microservicios[h]["Coupling AIS"],
      "couplingSIY": Number(microservicios[h]["Coupling SIY"]),
      "complexity": Number(microservicios[h]["Complexity"]),
      "id": microservicios[h]["key"],
      "points": microservicios[h]["Points"],
      "semanticSimilarity": Number(microservicios[h]["Semantic Similarity"]),
      "userStories": huCopia
    });
  }
  agregarGuiones();
}

function nuevoMSid() { // Retorna un nuevo ID no usado en el diagrama
  proximoMS = "";
  var MSs = nodos.filter((nodo) => {
    return nodo.componente === "microservicio"
  })
  var nombres = MSs.map((nodo) => {
    return nodo.id.replace("MS", "");
  })
  var nums = nombres.map(function (str) {
    return parseInt(str);
  });
  nums = nums.sort(function (a, b) {
    return a - b;
  });
  for (let i = 1; i < nums.length + 2; i++) {
    if (i !== nums[i - 1]) {
      proximoMS = "MS" + i;
      return proximoMS;
    }
  }
}

function crearMicroservicio(ms, us) {
  json = json.concat({
    "cohesionLack": 0,
    "cohesionGrade": 0,
    "couplingADS": 0,
    "couplingAIS": 0,
    "couplingSIY": 0,
    "complexity": 0,
    "id": ms,
    "points": 0,
    "semanticSimilarity": 100.00,
    "userStories": us
  });
}

function formatearUS(historia) {
  var dependenciasFormateadas = [];
  if (historia["Dependencies"]){
    for (let i = 0; i < historia["Dependencies"].length; i++) {
      dependenciasFormateadas = dependenciasFormateadas.concat({
        id: historia["Dependencies"][i]
      });
    }
  }
  var historiaFormateada = [ // Historia para el JSON
    {
      "id": historia.id,
      "name": historia.Name,
      "description": historia.Description,
      "actor": historia.Actor,
      "points": historia.Points,
      "project": proyecto,
      "priority": historia.Priority,
      "dependencies": dependenciasFormateadas
    }
  ]
  return historiaFormateada;
}

function quitarUSdeMS(ms, us) {
  for (let i = 0; i < Object(json).length; i++) {
    json[i].id = json[i].id.replace("-", "");
    if (json[i].id === ms) {
      for (let j = 0; j < json[i].userStories.length; j++) {
        json[i].userStories[j].id = json[i].userStories[j].id.replace("-", "");
        if (json[i].userStories[j].id === us[0].id) {
          json[i].userStories.splice(j, 1);
          return;
        }
      }
      return;
    }
  }
}

function init() {
  const $ = go.GraphObject.make;
  // set your license key here before creating the diagram: go.Diagram.licenseKey = "...";
  myDiagram = $(go.Diagram, "myDiagramDiv", { // crea un diagrama para el elemento DIV del HTML       
    "animationManager.initialAnimationStyle": go.AnimationManager.AnimateLocations,
    initialAutoScale: go.Diagram.Uniform,  // Hace visible todo el diagrama inicialmente

    "BackgroundSingleClicked": () => {
      document.getElementById('myInspectorDiv').style.visibility = 'hidden';
      document.getElementById('titulo').innerHTML = '';
    },

    // decide que tipo de partes se pueden agregar a un grupo
    "commandHandler.memberValidation": (grp, node) => {
      if (grp != null) { // permite arrastrar grupos en el fondo para cambiarles la posición
        if (node instanceof go.Group) { // No deja agregar un MS (grupo) a otro MS (grupo)
          return false;
        }
        return true;
      }
    },
    "undoManager.isEnabled": true, // Habilita deshacer y rehacer
    contentAlignment: go.Spot.Center,  // Centra el contenido en el viewport (ventana gráfica)
    isReadOnly: false,  // No permite modificar
    mouseDrop: (e, grp) => { // Devuelve al nodo a su posición original cuando se arrastra afuera
      var nodoSeleccionado = myDiagram.selection; // Guarda el US seleccionado
      var nuevaHistoria = formatearUS(nodoSeleccionado.ea.key.qb);
      try {
        var MSnombre = nodoSeleccionado.ea.key.qb.group; // Nombre del microservicio (grupo)
        var MScompleto = e.diagram.findNodeForKey(MSnombre);
        if (MScompleto.qb.userStories > 1) {
          var proximo = nuevoMSid(); // Crea un nuevo id de MS no repetido
          quitarUSdeMS(MSnombre, nuevaHistoria);
          crearMicroservicio(proximo, nuevaHistoria); // Crea nuevo MS y le asigna el id recién creado
          convertir_jsonAnodos(true, false, false); // (recalcular, recalcularSS, diagramar)
          convertir_nodosAjson(nodos);
          nuevoDiagrama(true);
        } else {
          myDiagram.currentTool.doCancel();
        }
      } catch (error) {

      }
    },
    mouseDragOver: function () {
      myDiagram.currentCursor = "grabbing";
      myDiagram.clearHighlighteds();
    },
    click: function () {
      myDiagram.currentCursor = "grabbing";
      myDiagram.clearHighlighteds();
    }
  });

  myDiagram.groupTemplate = $(go.Group, "Vertical", { // 'Vertical' Pone el nombre del nodo arriba    
    deletable: false, // No permite borrar el microservicio (grupo)
    copyable: false,
    handlesDragDropForMembers: true,
    computesBoundsAfterDrag: true  // Permite arrastrar historias fuera del MS sin deformarlo
  },
    {
      mouseOver: function (e) {
        e.diagram.currentCursor = "grab";
      },

      // Para cambiar el fill (color) cuando el cursor entra o sale
      mouseEnter: function (e, obj) {
        var microservicio = obj.findObject("MICROSERVICIO");
        microservicio.fill = "rgb(68, 100, 66)";
        obj.currentCursor = "hand";
      },
      mouseLeave: function (e, obj) {
        var microservicio = obj.findObject("MICROSERVICIO");
        microservicio.fill = "rgba(125, 200, 120, .6)";
      },
      click: function (e, node) {
        document.getElementById('myInspectorDiv').style.visibility = 'visible';
        document.getElementById('titulo').innerHTML = 'MICROSERVICE METRICS';
        var diagram = node.diagram;
        // quita iluminado previo
        diagram.clearHighlighteds();
        // iluminar todos los enlaces y MSs con relación a un MS seleccionado
        diagram.startTransaction("highlight");
        // ilumina cada nodo que sale del MicroServicio seleccionado (Link.isHighlighted)
        node.findLinksOutOf().each(function (l) { l.isHighlighted = true; });
        // ilumina MicroServicios relacionados con el MicroServicio seleccionado (Node.isHighlighted)
        node.findNodesOutOf().each(function (n) { n.isHighlighted = true; });
        diagram.commitTransaction("highlight");
      },

      // qué hacer cuando un drag-over o un drag-drop ocurre sobre un Microservicio (grupo)
      mouseDragEnter: (e, grp, prev) => {
        if (grp.canAddMembers(grp.diagram.toolManager.draggingTool.draggingParts)) {
          const shape = grp.findObject("MICROSERVICIO");
          if (shape) {
            shape.fill = "chartreuse";
          }
          grp.diagram.currentCursor = "";
        } else {
          grp.diagram.currentCursor = "no-drop";
        }
      },
      mouseDragLeave: (e, grp, next) => {
        const shape = grp.findObject("MICROSERVICIO");
        if (shape) {
          shape.fill = "rgba(125, 200, 120, .6)";
        }
        grp.diagram.currentCursor = "";
      },
      mouseDrop: (e, grp) => {
        var MSdesde = myDiagram.selection.ea.key.qb.group; // id del MS desde donde se coge la HU
        var MShacia = grp.qb.id; // id del MS a donde se suelta la HU
        const ok = grp.addMembers(grp.diagram.selection, true);
        if (!ok || MSdesde === MShacia) {
          grp.diagram.currentTool.doCancel();
          return;
        }        
        convertir_nodosAjson(nodos);
        convertir_jsonAnodos(true, false, false); // (recalcular, recalcularSS, diagramar)
        convertir_nodosAjson(nodos);
        nuevoDiagrama(true);
      }
    },
    new go.Binding("layout", "columnas", function (c) {
      return $(go.GridLayout, {
        wrappingColumn: c, // Determina cantidad de columnas
        cellSize: new go.Size(0, 0), // Determina ancho de columnas
        spacing: new go.Size(0, 0) // Determina espacio entre columnas
      });
    }),
    $(go.Panel, "Spot",
      //$(go.Shape, "Hexagon", {
      $(go.Shape, "Cube1", {
        name: "MICROSERVICIO",
        fill: "rgba(125, 200, 120, .6)"
      },
        new go.Binding("stroke", "isHighlighted", function (h) {
          return h ? "red" : null;
        }).ofObject(),
        new go.Binding("strokeWidth", "isHighlighted", function (h) {
          return h ? 2 : 3;
        }).ofObject(),
        new go.Binding("width", "size"), // Asigna al ancho el valor de size
        new go.Binding("height", "size") // Asigna a la altura el valor de size
      ), $(go.TextBlock, "text",
        new go.Binding("text", "key"), // Asigna al texto el valor de key
        new go.Binding("alignment", "textoID", function (c) {
          return new go.Spot(0.5, c); // Asigna valor a Y en la posición del
        }),
      ),
      $(go.Placeholder, { // Centra las HUs en el hexágono del microservicio
        padding: 1
      })
    )
  );

  myDiagram.nodeTemplate = $(go.Node, "Auto", { // 'Auto' Ajusta tamaño del elemento según subelementos. 
    locationSpot: go.Spot.Center,
    copyable: false,
    deletable: false // No permite borrar el nodo
  },
    {
      mouseOver: function (e, node) {
        e.diagram.currentCursor = "grab";
      },

      // Para cambiar el fill (color) cuando el cursor entra o sale
      mouseEnter: function (e, obj) {
        var microservicio = obj.findObject("HISTORIA");
        microservicio.fill = "gray";
        obj.currentCursor = "hand";
      },
      mouseLeave: function (e, obj) {
        var microservicio = obj.findObject("HISTORIA");
        microservicio.fill = "white";
      },
      click: function (e, node) {
        document.getElementById('myInspectorDiv').style.visibility = 'visible';
        document.getElementById('titulo').innerHTML = 'STORY METRICS';
        var diagram = node.diagram;
        // quita cualquier iluminado previo
        diagram.clearHighlighteds();
      }
    },
    $(go.Shape, "RoundedRectangle", {
      name: "HISTORIA",
      fill: "white"
    }),
    $(go.TextBlock, "text",
      new go.Binding("text", "key") // Asigna al texto el valor de key
    )
  );

  myDiagram.linkTemplate = $(go.Link, {
    curve: go.Link.Bezier,
    selectable: false,
    reshapable: false,
    deletable: false // No permite borrar la flecha
  },
    // No necesita guardar Link.points, por lo que no necesita TwoWay Binding en "puntos"
    new go.Binding("curviness", "curviness").makeTwoWay(),  // pero guarda "curvas" automáticamente
    $(go.Shape, { // Características del cuerpo de la flecha       
      strokeWidth: 2,
    },
      new go.Binding("stroke", "isHighlighted", function (h) {
        return h ? "red" : "black";
      }).ofObject(),
    ),
    $(go.Shape, { // Características de la cabeza de la flecha  
      toArrow: "standard", // Forma de la cabeza de la flecha  
      stroke: "white" // Borde de la cabeza de flecha
    })
  );

  // Crea el modelo del diagrama a mostrar
  myDiagram.model = new go.GraphLinksModel(nodos, aristas);

  const titulo = document.createElement("h2");
  titulo.textContent = proyecto;
  titulo.style.color = "white";
  titulo.style.textAlign = "center";
  document.getElementById('myDiagramDiv').appendChild(titulo);

  inspectors();

}

function inspectors() {
  // eslint-disable-next-line
  var inspector = new Inspector('myInspectorDiv', myDiagram, {
    //showAllProperties: true,
    includesOwnProperties: false, // Para no mostrar todas las propiedades 
    inspectSelection: true,
    properties: { // Declarar las propiedades que se quieren inspeccionar
      "id": {
        readOnly: true, // Para que no se pueda editar
        show: Inspector.showIfPresent
      },
      "Points": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "Dependencies": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "Coupling AIS": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "Coupling ADS": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "Coupling SIY": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "Cohesion Lack": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "Cohesion Grade": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "Complexity": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "Semantic Similarity": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "Actor": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "group": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "Name": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "Priority": {
        readOnly: true,
        show: Inspector.showIfPresent
      }
    }
  });

  // some shared model data
  myDiagram.model.modelData = {
    "CpT": CpT.toFixed(2),
    "CohT": CohT.toFixed(2),
    "SsT": "" + SsT.toFixed(2) + "%",
    "WsicT": WsicT,
    "CxT": CxT.toFixed(1),
    "Gm": Gm.toFixed(2)
  };

  // Siempre muestra el model.modelData:
  var inspector2 = new Inspector('myInspectorDiv2', myDiagram, {
    inspectSelection: false,
    properties: {
      "CpT": {
        readOnly: true
      },
      "CohT": {
        readOnly: true
      },
      "SsT": {
        readOnly: true
      },
      "WsicT": {
        readOnly: true
      }
    }
  });
  inspector2.inspectObject(myDiagram.model.modelData);
  document.getElementById('myInspectorDiv2').style.visibility = 'visible';
}

function validarJson(schema, jsonCargado) {
  const Ajv = require("ajv")
  const ajv = new Ajv({ allErrors: true })
  const validate = ajv.compile(schema)
  const valid = validate(jsonCargado)
  if (!valid) {
    console.log(validate.errors);
    swal({
      title: "Invalid schema",
      icon: "error",
      timer: 2000
    })
    return false;
  } else {
    return true;
  }
}

export function leerArchivo(e) {
  var archivo = e.target.files[0];
  if (!archivo) {
    return;
  }
  if (diagramaCargado) {
    myDiagram.div = null;
    myDiagram = null;
  }
  json = [];
  var lector = new FileReader();
  lector.onload = function (e) {
    var jsonData = e.target.result;
    json = JSON.parse(jsonData);
    var schema = require('./schemas/microservices.json');
    var esValido = validarJson(schema, json);
    if (esValido) {
      convertir_jsonAnodos(false, false, true); // (recalcular, recalcularSS, diagramar)
    } else {
      diagramaCargado = false;
      AIST = 0;
      ADST = 0;
      SIYT = 0;
      CpT = 0;
      CohT = 0;
      WsicT = 0;
      SsT = 0;
      nodos = [];
      aristas = [];
      document.getElementById('myInspectorDiv').style.visibility = 'hidden';
      document.getElementById('myInspectorDiv2').style.visibility = 'hidden';
    }
  };
  lector.readAsText(archivo);
  document.getElementById("miInput").value = null;
}

function verificarHistoria() {   // Verifica la existencia de una historia de usuario 
  // en un diagrama de microservicios
  for (let h = 0; h < userStory.length; h++) {
    for (let i = 0; i < json.length; i++) {
      for (let j = 0; j < json[i].userStories.length; j++) {
        userStory[h].id = userStory[h].id.replace("-", "");
        if (json[i].userStories[j].id === userStory[h].id) {
          swal({
            title: "The story " + userStory[h].id + " is already in the project",
            text: "Operation cancelled",
            icon: "warning"
          })
          return true;
        }
      }
    }
  }
  swal({
    title: "Stories included succesfully",
    icon: "success",
    timer: 1500
  })
  return false;
}

function agregarHistoria(e) {
  var archivo = e.target.files[0];
  if (diagramaCargado) {
    if (!archivo) {
      return;
    }
    var lector = new FileReader();
    lector.onload = function (e) {
      var userStoryData = e.target.result;
      var file = JSON.parse(userStoryData)
      userStory = file.userStories;
      var schema = require('./schemas/userStories.json');
      var esValido = validarJson(schema, userStory);
      if (esValido) {
        var existeHistoria = verificarHistoria();
        if (!existeHistoria) {
          var micro_servicio = nuevoMSid();
          crearMicroservicio(micro_servicio, userStory);
          nuevoDiagrama(true);
        }
      }
    };
    lector.readAsText(archivo);
  } else {
    swal({
      title: "Cargue un diagrama primero",
      text: "¿Desea realizar una descomposición manual?",
      icon: "error",
      buttons: ['Cancel', 'Accept']
    }).then(respuesta => {
      if (respuesta) {
        if (!archivo) {
          return;
        }
        var lector = new FileReader();
        lector.onload = function (e) {
          var userStoryData = e.target.result;
          var file = JSON.parse(userStoryData)
          userStory = file.userStories;
          var schema = require('./schemas/userStories.json');
          var esValido = validarJson(schema, userStory);
          if (esValido) {
            json = [];
            nodos = [];
            var micro_servicio = nuevoMSid();
            crearMicroservicio(micro_servicio, userStory);
            nuevoDiagrama(true);
          }
        };
        lector.readAsText(archivo);
      }
    })
  }
  document.getElementById("miInput2").value = null;
}

function agregarGuiones() {
  var nuevoJson = [];
  for (let i = 0; i < Object(json).length; i++) {
    if (json[i].userStories.length > 0) {
      json[i].id = json[i].id.replace("-", ""); // Evita guiones duplicados
      json[i].id = json[i].id.replace("MS", "MS-");
      for (let j = 0; j < Object(json[i].userStories).length; j++) {
        json[i].userStories[j].id = json[i].userStories[j].id.replace("-", "");
        json[i].userStories[j].id = json[i].userStories[j].id.replace("US", "US-");
        for (let k = 0; k < Object(json[i].userStories[j].dependencies).length; k++) {
          json[i].userStories[j].dependencies[k].id = json[i].userStories[j].dependencies[k].id.replace("-", "");
          json[i].userStories[j].dependencies[k].id = json[i].userStories[j].dependencies[k].id.replace("US", "US-");
        }
      }
      nuevoJson = nuevoJson.concat(json[i]);
    }
  }
  json = nuevoJson;
}

function exportarJson() {
  if (diagramaCargado) {
    convertir_nodosAjson(nodos); // Se llama para guardar en el JSON la config actual
    var dataStr = JSON.stringify(json);
    var dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    // Se obtiene la fecha para el nombre del archivo
    var fecha = new Date();
    var hora = fecha.toLocaleTimeString('it-IT');
    fecha = fecha.toLocaleDateString('en-US');

    // Asigna un nombre al archivo que se va a exportar
    var nombreArchivo = proyecto + " " + fecha + "-" + hora + '.json'; // Asigna un nombre al archivo

    var linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', nombreArchivo);
    linkElement.click();
  } else {
    swal({
      title: "Cargue un diagrama primero",
      icon: "error",
      timer: 2000
    })
  }
}

async function nuevoDiagrama(recalcular) {
  if (diagramaCargado === true) {
    myDiagram.div = null;
    myDiagram = null;
  }
  if (recalcular === true) {
    await consultarBD()
    if (nueva_config) {
      convertir_jsonAnodos(true, true, true); // (recalcular, recalcularSS, diagramar)
    } else {
      convertir_jsonAnodos(false, false, true); // (recalcular, recalcularSS, diagramar)
    }
  } else {
    convertir_jsonAnodos(false, false, true); // (recalcular, recalcularSS, diagramar)
  }
  diagramaCargado = true;
}

function cambiar_tamano() {
  document.getElementById('titulo').innerHTML = '';
  document.getElementById('myInspectorDiv').style.visibility = 'hidden';
  if (diagramaCargado === true) {
    nuevoDiagrama(false);
  }
}

// render function...
export function App() {
  return (
    <div>
      <span id='spanEncabezado'>
        <div id="encabezado"></div>
      </span>
      <span className='spanInspector'>
        <div className="fondoInspector">
          <div id='inputsDiv'>
            <div className="file-select" id="src-file1" >
              <input onInput={leerArchivo} className='boton' type="file" id='miInput' />
            </div>
            <div className="file-select" id="src-file2" >
              <input onInput={agregarHistoria} className='boton' type="file" id='miInput2' />
            </div>
            <div className="file-select" id="src-file3" >
              <button onClick={exportarJson} className='boton' type="button" id='miInput3' />
            </div>
          </div>
          <h3 id='titulo' className="informacion"> </h3>
          <div id="myInspectorDiv" className="inspector"></div>
        </div>
      </span>
      <span id='spanDiagram'>
        <div id='myDiagramDiv'></div>
      </span>
      <span className='spanInspector'>
        <div className="fondoInspector">
          <div id='MSsize'>
            <h3 className="informacion">MICROSERVICE SIZE:</h3>
            <label className="container">STORIES
              <input id="stories" onClick={cambiar_tamano} type="radio" defaultChecked="checked" name="radio" />
              <span className="checkmark"></span>
            </label>
            <label className="container">POINTS
              <input id="points" onClick={cambiar_tamano} type="radio" name="radio" />
              <span className="checkmark"></span>
            </label>
          </div>
          <h3 className="informacion">APP METRICS:</h3>
          <div id="myInspectorDiv2" className="inspector"></div>
        </div>
      </span>
    </div>
  );
}

// Si se habilita esta línea, se ejecuta la función Init cuando el HTML carga el script
window.addEventListener('DOMContentLoaded', recibe_parametro);
