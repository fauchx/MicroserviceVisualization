//************* Imports *****************/
import React from 'react';
import * as go from 'gojs';
import '../node_modules/gojs/extensions/Figures'
import { Inspector } from '../node_modules/gojs/extensionsJSM/DataInspector.js'
import './css/App.css';  // contains .diagram-component CSS
import swal from 'sweetalert'
import schema from "./schemas/microservices.json";
import {API_URL} from "./utils";

//************ Variables ****************/

var myDiagram;
var nodos = [];
var aristas = [];
var diagramaCargado = false;
var json;
var userStory = [];
var proximoMS = "";
var CantidadMSs = 0;

var AIST = 0; // Acoplamiento AIS total
var ADST = 0; // Acoplamiento ADS total
var SIYT = 0; // Acoplamiento SIY total
var CpT = 0;  // Acoplamiento total de la aplicación

var Coh = 0;  // Cohesion grade total
var CohT = 0; // Cohesión total de la aplicación

var WsicT = 0;// mayor número de historias de usuario asociadas a un microservicio
var CxT = 0;  // Complejidad cognitiva total de la aplicación
var SsT = 0;  // Similitud semántica total de la aplicación
/*
𝑀𝑆𝐵𝐴=(𝑀𝑆, 𝑀𝑇 ⃗) 
Donde:
𝑀𝑆𝐵𝐴 = MicroServices Based Application
MS es un conjunto de microservicios MS = {ms1, ms2, …, msn} 
𝑀𝑇 ⃗ es un vector de métricas calculadas para MSBA

𝑀𝑇 ⃗=[𝐶𝑝𝑇, 𝐶𝑜ℎ𝑇, 𝑊𝑠𝑖𝑐𝑇, 𝐶𝑥𝑇,(100− 𝑆𝑠𝑇)]
Donde:
CpT es el acoplamiento, 
CohT es la cohesión, 
WsicT es el mayor número de historias de usuario asociadas a un microservicio, 
CxT son los puntos de complejidad cognitiva, y 
SsT es la similitud semántica; Las cuales son métricas calculadas para MSBA
*/

/* Cx = (sum(c𝑔)) + maxMSpoints + (CantidadMSs*WsicT) + (sum(Pf)) + (sum(SIY)) */
var maxMSpoints = 0;
var Cx = 0;
var sumCg = 0;
var sumPf = 0; // Número (máximo?) de llamadas secuenciales entre microservicios
var sumSIY = 0;

/* CxT = Cx / Cxo */

//************ Funciones ****************/

function recibe_parametro(props) {
  const query = new URLSearchParams(props.target.location.search);
  var diagrama = query.get('diagrama')
  console.log(diagrama)
  if (diagrama !== null) {
    try {
      fetch(diagrama)
        .then(response => response.json())
        .then(data => {
          console.log(data)
          json = data;
          var schema = require('./schemas/microservices.json');
          var esValido = validarJson(schema, data);
          if (esValido) {
            nuevoDiagrama();
          }
        });

    } catch {
      //
    }
  }
}

function complejidad(nodos2, nombreMS) {
  var matriz = [[nombreMS]];
  var prof = [0]; // ïndice de profundidad del nodo a expandir
  var padre = [];
  var resultado = 0; // Variable para retornar la complejidad cognitiva
  while (matriz.length > 0) { // Algoritmo de búsqueda por Amplitud
    padre = matriz[0]; // padre = arreglo de MS's
    nombreMS = padre[prof[0]] // Nombre del MS a buscar las dependencias
    for (let i = 0; i < nodos2.length; i++) { // Recorre todos los nodos
      if (nodos2[i].id === nombreMS) { // Encuentra el MS a expandir sus dependencias
        var depend = nodos[i].dependencies; // Arreglo de dependencias
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
  var similitudSemantica = 0;
  if (nombres_HU.length > 1) {
    for (let i = 1; i < nombres_HU.length; i++) {
      cadena = cadena + "/" + nombres_HU[i];
    }
    const encodedValue = encodeURIComponent(cadena);
    swal({
      title: "Loading stories",
      icon: "success",
    })
    await new Promise((resolve, reject) => {
      fetch(`${API_URL}/?user_stories=${encodedValue}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
      }).then(function (response) {
        setTimeout(() => {
          resolve(response)
        }, 50);
        return response.json();
      }).then(json => {
        resultado = json;
        similitudSemantica = parseFloat(resultado.semantic_similarity)
        swal({
          title: "Loading stories",
          icon: "success",
          timer: 100
        })
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
  } else {
    similitudSemantica = 1;
  }
  return similitudSemantica;
}

async function convertir_jsonAnodos() {

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
  nodos = [];
  aristas = [];

  for (let i = 0; i < Object(json).length; i++) {
    var MSdependencias = [];
    var MScalls = [];
    var MSpuntos = 0;
    var nombresHU = [];
    for (let j = 0; j < Object(json[i].userStories).length; j++) {
      var USdependencias = [];
      var UScalls = [];
      json[i].userStories[j].id = json[i].userStories[j].id.replace("-", "");
      nombresHU = nombresHU.concat(json[i].userStories[j].name);
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
                  UScalls = UScalls.concat(json[i].userStories[j].dependencies[k].id);/////////////////////
                  if (json[i].id !== json[l].id) { // Si son diferentes MS's se asigna el valor a 'to'.
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
        actor: json[i].userStories[j].actor,
        componente: "historia",
        dependencies: USdependencias,
        group: json[i].id,
        id: json[i].userStories[j].id,
        key: json[i].userStories[j].id,
        name: json[i].userStories[j].name,
        priority: json[i].userStories[j].priority,
        project: json[i].userStories[j].project,
        points: json[i].userStories[j].points
      });
    }

    /* Hacer este filter abajo si se quieren mostrar las dependencias repetidas en el Inspector*/
    // eslint-disable-next-line
    MSdependencias = MScalls.filter((item, index) => {// Quita las dependencias repetidas
      return MScalls.indexOf(item) === index;
    })

    if (json[i].userStories.length !== 0) {
      CantidadMSs++;
      nodos = nodos.concat({
        calls: MScalls.length,
        cg: 0,
        coupling_AIS: 0,
        coupling_ADS: MSdependencias.length,
        coupling_SIY: 0,
        cohesion_lack: 0,
        cohesion_grade: 0,
        columnas: Math.ceil(Math.sqrt(json[i].userStories.length)),
        complexity: 0,
        componente: "microservicio",
        dependencies: MSdependencias, // o 'MScalls' si quiere mostrar repetidos 
        isGroup: true,
        id: json[i].id,
        key: json[i].id,
        points: MSpuntos,
        requests: 0,
        semantic_similarity: await similitud_semantica(nombresHU),
        // eslint-disable-next-line
        size: (function () {
          if (document.getElementById('stories').checked) {
            return 45 + (json[i].userStories.length * 12);
          } else {
            return 45 + (MSpuntos * 12);
          }
        })(),
        textoID: 0.23 - ((((45 + (json[i].userStories.length * 12)) - 57) * 0.12) / 100),
        userStories: json[i].userStories.length
      });
    }
    ADST = ADST + Math.pow(MSdependencias.length, 2) // Sumatoria de los cuadrados
  };

  // Quitar las aristas con 'to' undefined
  aristas = aristas.filter((item) => item.to !== undefined);

  var rendimiento = 0;

  // Cálculo de los acomplamientos AIS y SIY
  for (let i = 0; i < nodos.length; i++) {
    if (nodos[i].componente === "microservicio") {
      var LC = CantidadMSs - 1; // Cohesion Lack

      // Cálculo del acomplamiento AIS (Cantidad de aristas que le entran)
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
      nodos[i].coupling_AIS = MSimportancia.length;
      AIST = AIST + Math.pow(MSimportancia.length, 2); // Sumatoria de los cuadrados

      // Cálculo del acomplamiento SIY (interdependencias / cantidad de MS's)
      var interdependencias = [];
      // eslint-disable-next-line
      var interdepA = nodos[i].dependencies.filter((item, index) => {// Quita las depen-
        return nodos[i].dependencies.indexOf(item) === index;// dencias(1) repetidas
      })
      for (let j = 0; j < interdepA.length; j++) { // para comparar cada dependencia(1)
        for (let k = 0; k < nodos.length; k++) { // Inicia de nuevo en todos los nodos
          if (nodos[k].componente === "microservicio") { // solo los nodos MS's
            // eslint-disable-next-line
            var interdepB = nodos[k].dependencies.filter((item, index) => {
              return nodos[k].dependencies.indexOf(item) === index;
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
      var SIY = (interdependencias.length / CantidadMSs)
      nodos[i].coupling_SIY = SIY.toFixed(2);
      SIYT = SIYT + Math.pow(SIY, 2); // Sumatoria de los cuadrados

      // Cálculo de Cohesion Lack  y Grade
      nodos[i].cohesion_lack = LC;
      Coh = LC / CantidadMSs;
      nodos[i].cohesion_grade = Coh.toFixed(2);
      CohT = CohT + Math.pow(Coh, 2); // Sumatoria de los cuadrados

      // Cálculo de la similitud semántica
      SsT = SsT + nodos[i].semantic_similarity // Sumatoria previa

      // Cálculo de la complejidad cognitiva CxT
      nodos[i].complexity = complejidad(nodos, nodos[i].id);

      /*        Otros         */
      rendimiento = rendimiento + nodos[i].calls;
      // cg = MSpuntos * (MScalls + MSrequests)
      nodos[i].cg = nodos[i].points * (nodos[i].calls + MSrequests.length);
      console.log(nodos[i].id + ".cg: " + nodos[i].cg.toFixed(2));
      //
      if (nodos[i].points > maxMSpoints) {
        maxMSpoints = nodos[i].points;
      }

      sumPf = sumPf + nodos[i].complexity;
      sumCg = sumCg + nodos[i].cg;
      sumSIY = sumSIY + SIY;

      // Cx = (sum(c𝑔)) + maxMSpoints + (CantidadMSs*WsicT) + (sum(Pf)) + (sum(SIY)) 
      Cx = sumCg + maxMSpoints + (CantidadMSs * WsicT) + sumPf + sumSIY
      CxT = Cx / 2;
    }
  }
  AIST = Math.sqrt(AIST);
  ADST = Math.sqrt(ADST);
  SIYT = Math.sqrt(SIYT);
  CpT = Math.sqrt(Math.pow(AIST, 2) + Math.pow(ADST, 2) + Math.pow(SIYT, 2));
  CohT = Math.sqrt(CohT);
  SsT = SsT * (100 / CantidadMSs);

  /*          Otros           */
  rendimiento = rendimiento / CantidadMSs;
  console.log("  *** OTRAS MÉTRICAS DE LA APLICACIÓN ***")
  console.log("Rendimiento: " + rendimiento.toFixed(2));
  console.log("Max ponits: " + maxMSpoints.toFixed(2));
  console.log("Cx: " + Cx.toFixed(2));
  console.log("CxT: " + CxT.toFixed(2));

  // console.log("sumCg: " + sumCg);
  // console.log("sumPf: " + sumPf);
  // console.log("sumSIY: " + sumSIY);

  diagramaCargado = true;
  init();
}

function convertir_nodosAjson(nodosAjson) {
  json = [];
  var hu = [];
  var microservicios = [];
  microservicios = nodosAjson.filter((item) => item.componente === 'microservicio')

  for (let i = 0; i < Object(microservicios).length; i++) {
    hu = nodosAjson.filter((item) => (
      item.componente === 'historia' && item.group === microservicios[i].key
    ))
    for (let i = 0; i < hu.length; i++) {
      var dependenciasFormateadas = [];
      for (let j = 0; j < hu[i].dependencies.length; j++) {
        dependenciasFormateadas = dependenciasFormateadas.concat({
          id: hu[i].dependencies[j]
        });
      }
      hu[i].dependencies = dependenciasFormateadas;
    }
    json = json.concat({
      "cohesion_lack": microservicios[i].cohesion_lack,
      "cohesion_grade": microservicios[i].cohesion_grade,
      "complexity": microservicios[i].complexity,
      "id": microservicios[i].key,
      "points": microservicios[i].points,
      "semantic_similarity": microservicios[i].semantic_similarity,
      "userStories": hu
    });
  }
}

function nuevoMSid() { // Retorna un nuevo ID no usado en el diagrama
  proximoMS = "";
  var MSs = nodos.filter((nodo) => {
    return nodo.componente === "microservicio"
  })
  var nombres = MSs.map((nodo) => {
    return nodo.id.replace("MS", "");
  })
  nombres.sort();
  var nums = nombres.map(function (str) {
    return parseInt(str);
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
    "cohesion_lack": 0,
    "cohesion_grade": 0,
    "complexity": 0,
    "id": ms,
    "points": 0,
    "semantic_similarity": 0,
    "userStories": us
  });
}

function formatearUS(historia) {
  var dependenciasFormateadas = [];
  for (let i = 0; i < historia.dependencies.length; i++) {
    dependenciasFormateadas = dependenciasFormateadas.concat({
      id: historia.dependencies[i]
    });
  }
  var historiaFormateada = [
    {
      "id": historia.id,
      "name": historia.name,
      "actor": historia.actor,
      "points": historia.points,
      "project": historia.project,
      "priority": historia.priority,
      "dependencies": dependenciasFormateadas
    }
  ]
  return historiaFormateada;
}

function quitarUSdeMS(ms, us) {
  for (let i = 0; i < Object(json).length; i++) {
    if (json[i].id === ms) {
      for (let j = 0; j < json[i].userStories.length; j++) {
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
  myDiagram = $(go.Diagram, "myDiagramDiv", { // create a Diagram for the DIV HTML element       
    "animationManager.initialAnimationStyle": go.AnimationManager.AnimateLocations,
    //autoScale: go.Diagram.Uniform,  // scale always has all content fitting in the viewport

    "BackgroundSingleClicked": () => {
      document.getElementById('myInspectorDiv').style.visibility = 'hidden';      
      document.getElementById('titulo').innerHTML = '';
    },

    // decide what kinds of Parts can be added to a Group or to top-level
    "commandHandler.memberValidation": (grp, node) => {
      if (grp != null) { // maybe allow dropping groups in diagram's background
        if (node instanceof go.Group) { // No deja agregar un grupo a otro grupo
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
        var MSnombre = nodoSeleccionado.ea.key.qb.group; // Nombre del grupo
        var MScompleto = e.diagram.findNodeForKey(MSnombre);
        if (MScompleto.qb.userStories > 1) {
          var proximo = nuevoMSid(); // Crea un nuevo id de MS no repetido
          quitarUSdeMS(MSnombre, nuevaHistoria);
          crearMicroservicio(proximo, nuevaHistoria); // Crea nuevo MS y le asigna el id recién creado
          nuevoDiagrama();
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
    deletable: false, // No permite borrar el grupo
    copyable: false,
    //isActionable: true,
    handlesDragDropForMembers: true,  // don't need to define handlers on Nodes and Links
    computesBoundsAfterDrag: true  // Permite arrastrar la historia fuera del
    // microservicio sin deformarlo
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
        // remove any previous highlighting
        diagram.clearHighlighteds();
        // highlight all Links and Nodes coming out of a given Node
        diagram.startTransaction("highlight");
        //diagram.clearHighlighteds();
        // for each Link coming out of the Node, set Link.isHighlighted
        node.findLinksOutOf().each(function (l) { l.isHighlighted = true; });
        // for each Node destination for the Node, set Node.isHighlighted
        node.findNodesOutOf().each(function (n) { n.isHighlighted = true; });
        diagram.commitTransaction("highlight");
      },

      // what to do when a drag-over or a drag-drop occurs on a Group
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
        const ok = grp.addMembers(grp.diagram.selection, true);
        if (!ok) {
          grp.diagram.currentTool.doCancel();
          return;
        }
        convertir_nodosAjson(nodos);
        nuevoDiagrama();
      }
    },
    new go.Binding("layout", "columnas", function (c) {
      return $(go.GridLayout, {
        wrappingColumn: c, // Determina cantidad de columnas
        cellSize: new go.Size(0, 0), // Determina ancho de columnas
        spacing: new go.Size(0, 0) // Determina espacio entre columnas
      });
    }),
    // Inhabilitar el movimiento de los nodos resaltados:
    //new go.Binding("isActionable", "isHighlighted", function (h) {
    //return h ? true : false;
    //}).ofObject(),
    $(go.Panel, "Spot",
      //$(go.Shape, "Hexagon", {
      $(go.Shape, "Cube1", {
        name: "MICROSERVICIO",
        fill: "rgba(125, 200, 120, .6)"
      },
        new go.Binding("stroke", "isHighlighted", function (h) {
          return h ? "red" : null;
        }).ofObject(),
        new go.Binding("stroke", "isSelected", function (h) {
          return h ? "rgb(30,144,255)" : null;
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

  myDiagram.nodeTemplate = $(go.Node, "Auto", { // 'Auto' Ajusta el tamaño del elemento según sus subelementos. 
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
        // remove any previous highlighting
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
    reshapable: true,
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

  inspectors();
  
} // fin del Init()

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
      "points": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "dependencies": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "coupling_AIS": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "coupling_ADS": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "coupling_SIY": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "cohesion_lack": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "cohesion_grade": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "complexity": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "semantic_similarity": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "actor": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "group": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "name": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "priority": {
        readOnly: true,
        show: Inspector.showIfPresent
      },
      "project": {
        readOnly: true,
        show: Inspector.showIfPresent
      }
    }
  });

  // some shared model data
  myDiagram.model.modelData = {
    "AIST": AIST.toFixed(2),
    "ADST": ADST.toFixed(2),
    "SIYT": SIYT.toFixed(2),
    "CpT": CpT.toFixed(2),
    "CohT": CohT.toFixed(2),
    "SsT": SsT.toFixed(2),
    "WsicT": WsicT
  };

  // Siempre muestra el model.modelData:
  var inspector2 = new Inspector('myInspectorDiv2', myDiagram, {
    inspectSelection: false,
    properties: {
      "AIST": {
        readOnly: true
      },
      "ADST": {
        readOnly: true
      },
      "SIYT": {
        readOnly: true
      },
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
      convertir_jsonAnodos();
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
          nuevoDiagrama();
        }
      }
    };
    lector.readAsText(archivo);
  } else {
    swal({
      title: "Cargue un diagrama primero",
      text: "Desea crear un diagrama?",
      icon: "error",
      buttons: ['Cancel', 'Accept']
    }).then(respuesta => {
      if (respuesta) {
        if (!archivo) {
          console.log("No hay archivo");
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
            nuevoDiagrama();
          }
        };
        lector.readAsText(archivo);
      }
    })
  }
  document.getElementById("miInput2").value = null;
}

function exportarJson() {
  if (diagramaCargado) {
    var dataStr = JSON.stringify(json);
    var dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    var exportFileDefaultName = 'data.json'; // Asigna un nombre al archivo

    var linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  } else {
    swal({
      title: "Cargue un diagrama primero",
      icon: "error",
      timer: 2000
    })
  }
}

function nuevoDiagrama() {
  if (diagramaCargado === true) {
    myDiagram.div = null;
    myDiagram = null;
  }
  convertir_jsonAnodos();
  diagramaCargado = true;
}

function cambiar_tamano() {    
  document.getElementById('titulo').innerHTML = '';
  document.getElementById('myInspectorDiv').style.visibility = 'hidden';
  if (diagramaCargado === true) {
    nuevoDiagrama();
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
          <h3 className="informacion">APP METRICS:</h3>
          <div id="myInspectorDiv2" className="inspector"></div>
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
        </div>
      </span>
    </div>
  );
}

// Si se habilita esta línea, se ejecuta la función Init cuando el HTML carga el script
window.addEventListener('DOMContentLoaded', recibe_parametro);

/*        Código pregunta en SweetAlert
swal({
  title: "Título de la pregunta",
  text: "Acepta esta pregunta?",
  icon: "warning",
  buttons: ['Cancelar', 'Aceptar']
}).then(respuesta => {
  if (respuesta) {
    swal({
      title: "Aceptó la pregunta",
      icon: "success",
      timer: 1500
    })
  }
})
*/
//function mostrarContenido(contenido) {
//  var elemento = document.getElementById('contenido-archivo');
//  elemento.innerHTML = contenido; // Inyecta un contenido a un elemento HTML en la página
//}

//<script>
//addEventListener = {document.addEventListener('change', LeerArchivo, false)}
//</script>

//export default App
