define(function (require) {
    'use strict';

    const _ = require('lodash');
    const glUtils = require('common/gl-utils');
    require('sylvester');

    function initShader (gl, vertexShader, fragmentShader, uniforms, attributes) {
        uniforms = uniforms || [];
        attributes = attributes || [];

        let fragmentShaderProg = getShaderFromDocument(gl, fragmentShader);
        let vertexShaderProg = getShaderFromDocument(gl, vertexShader);

        // Create the shader program

        let shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShaderProg);
        gl.attachShader(shaderProgram, fragmentShaderProg);
        gl.linkProgram(shaderProgram);

        // If creating the shader program failed, alert
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert("Unable to initialize the shader program.");
        }

        gl.useProgram(shaderProgram);

        let uniformLocations = {};
        // for (var uniform of uniforms) {
        //
        // }

        let attributeLocations = {};
        for (let attribute of attributes) {
            let attributeLocation = gl.getAttribLocation(shaderProgram, attribute);
            gl.enableVertexAttribArray(attributeLocation);
            attributeLocations[attribute] = attributeLocation;
        }

        gl.useProgram(null);

        return {
            shaderProgram: shaderProgram,
            uniformLocations: uniformLocations,
            attributeLocations: attributeLocations
        };
    }

    //
    // getShader
    //
    // Loads a shader program by scouring the current document,
    // looking for a script with the specified ID.
    //
    function getShaderFromDocument (gl, id) {
        let shaderScript = document.getElementById(id);

        // Didn't find an element with the specified ID; abort.

        if (!shaderScript) {
            return null;
        }

        // Walk through the source element's children, building the
        // shader source string.

        let theSource = "";
        let currentChild = shaderScript.firstChild;

        while(currentChild) {
            if (currentChild.nodeType === 3) {
                theSource += currentChild.textContent;
            }

            currentChild = currentChild.nextSibling;
        }

        // Now figure out what type of shader script we have,
        // based on its MIME type.

        let shader;

        if (shaderScript.type === "x-shader/x-fragment") {
            shader = gl.createShader(gl.FRAGMENT_SHADER);
        } else if (shaderScript.type === "x-shader/x-vertex") {
            shader = gl.createShader(gl.VERTEX_SHADER);
        } else {
            return null;  // Unknown shader type
        }

        // Send the source to the shader object

        gl.shaderSource(shader, theSource);

        // Compile the shader program

        gl.compileShader(shader);

        // See if it compiled successfully

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    }

    //
    // Matrix utility functions
    //
    function loadIdentity () {
        return Matrix.I(4);
    }

    function multMatrix (m1, m2) {
        return m1.x(m2);
    }

    function mvTranslate (mv, v) {
        return multMatrix(mv, Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4());
    }

    return _.extend(glUtils, {
        initShader,
        getShaderFromDocument,
        loadIdentity,
        multMatrix,
        mvTranslate
    });
});