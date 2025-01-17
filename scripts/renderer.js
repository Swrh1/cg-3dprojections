const LEFT = 32; // binary 100000
const RIGHT = 16; // binary 010000
const BOTTOM = 8;  // binary 001000
const TOP = 4;  // binary 000100
const FAR = 2;  // binary 000010
const NEAR = 1;  // binary 000001
const FLOAT_EPSILON = 0.000001;

class Renderer {
    // canvas:              object ({id: __, width: __, height: __})
    // scene:               object (...see description on Canvas)
    constructor(canvas, scene) {
        this.canvas = document.getElementById(canvas.id);
        this.canvas.width = canvas.width;
        this.canvas.height = canvas.height;
        this.ctx = this.canvas.getContext('2d');
        this.scene = this.processScene(scene);
        this.enable_animation = true;  // <-- disabled for easier debugging; enable for animation
        this.start_time = null;
        this.prev_time = null;
        this.model = 0; // <--- change this to change the model
        this.rotate = new Matrix(4,4);
        this.rotfactor = 0.001;
        this.center = [0,0,0];
    }

    //////////////////
    //TODO: Make a function that makes a circle in the verticie and edge tables
    /////////////////

    //
    updateTransforms(time, delta_time) {
        let x = new Matrix(4,4);
        let y = new Matrix(4,4);
        let z = new Matrix(4,4);
        mat4x4RotateX(x, this.rotfactor*time);
        mat4x4RotateY(y, this.rotfactor*time);
        mat4x4RotateZ(z, this.rotfactor*time);
        this.rotate = Matrix.multiply([x,y,z]);
    }

    // Left arrow key: rotate SRP around the v-axis with the PRP as the origin NEGATIVE
    rotateLeft() {
        let u_axis = this.scene.view.vup.cross(this.scene.view.srp);
        u_axis.normalize();
        this.scene.view.vup = this.scene.view.vup.subtract(u_axis);
        this.draw();
    }

    // Right arrow key: rotate SRP around the v-axis with the PRP as the origin POSITIVE
    rotateRight() {
        // probably need to translate the SRP to the PRP, increase it by one or so,
        // then translate it back to the original spot.
        let u_axis = this.scene.view.vup.cross(this.scene.view.srp);
        u_axis.normalize();
        this.scene.view.vup = this.scene.view.vup.add(u_axis);
        this.draw();
    }

    // A key: translate the PRP and SRP along the u-axis
    moveLeft() {
        let n_axis = this.scene.view.prp.subtract(this.scene.view.srp);
        n_axis.normalize();
        let u_axis = this.scene.view.vup.cross(n_axis);
        u_axis.normalize();
        this.scene.view.srp = this.scene.view.srp.subtract(u_axis);
        this.scene.view.prp = this.scene.view.prp.subtract(u_axis);
        this.draw();
    }

    // D key: translate the PRP and SRP along the u-axis  /////////////!
    moveRight() {
        let n_axis = this.scene.view.prp.subtract(this.scene.view.srp);
        n_axis.normalize();
        let u_axis = this.scene.view.vup.cross(n_axis);
        u_axis.normalize();
        this.scene.view.srp = this.scene.view.srp.add(u_axis);
        this.scene.view.prp = this.scene.view.prp.add(u_axis);
        this.draw();
    }

    // S key: translate the PRP and SRP along the n-axis
    moveBackward() {
        let n_axis = this.scene.view.prp.subtract(this.scene.view.srp);
        n_axis.normalize();
        this.scene.view.srp = this.scene.view.srp.add(n_axis);
        this.scene.view.prp = this.scene.view.prp.add(n_axis);
        this.draw();
    }

    // W key: translate the PRP and SRP along the n-axis
    moveForward() {
        let n_axis = this.scene.view.prp.subtract(this.scene.view.srp);
        n_axis.normalize();
        this.scene.view.srp = this.scene.view.srp.subtract(n_axis);
        this.scene.view.prp = this.scene.view.prp.subtract(n_axis);
        this.draw();
    }

    get_center(verts)
    {
        let max_x = verts[0].x;
        let max_y = verts[0].y;
        let max_z = verts[0].z;
        let min_x = verts[0].x;
        let min_y = verts[0].y;
        let min_z = verts[0].z;
        for(let i=0;i<verts.length;i++)
        {
            if(verts[i].x > max_x)
            {
                max_x = verts[i].x;
            }

            if(verts[i].y > max_y)
            {
                max_y = verts[i].y;
            }

            if(verts[i].z > max_z)
            {
                max_z = verts[i].z;
            }

            if(verts[i].x < min_x)
            {
                min_x = verts[i].x;
            }

            if(verts[i].y < min_y)
            {
                min_y = verts[i].y;
            }

            if(verts[i].z < min_z)
            {
                min_z = verts[i].z;
            }
        }
        return [(max_x+min_x)/2, (max_y+min_y)/2, (max_z+min_z)/2];
    }

    //
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // TODO: update any transformations needed for animation
        let Nper = mat4x4Perspective(this.scene.view.prp, this.scene.view.srp, this.scene.view.vup, this.scene.view.clip);
        let MNper = Matrix.multiply([mat4x4MPer(), Nper]);
        let newpoints = [];

        // this.scene.models[this.model].vertices.forEach(function (vertex) {
        //     vertex = Matrix.multiply([MNper, vertex]);
        //     vertex.scale((1/vertex.w));
        //     newpoints.push(vertex);
        // });
        for (let i = 0; i < newpoints.length; i++) {
            newpoints[i] = Matrix.multiply([mat4x4Viewport(this.canvas.width,this.canvas.height), newpoints[i]]);
        }

        let viewport = mat4x4Viewport(this.canvas.width, this.canvas.height);;

        let clipOrigin = this.scene.view.clip;

        //z_min = -near/far
        let zmin1 = -(clipOrigin[4]) / clipOrigin[5];

        // Instructions: 
        // For each model
        //   * For each vertex
        //     * transform endpoints to canonical view volume
        //   * For each line segment in each edge
        //     * clip in 3D
        //     * project to 2D
        //     * translate/scale to viewport (i.e. window)
        //     * draw line

        //Get all the centers
        this.scene.models.forEach(element => {
            //this.center.push(get_center());
        });
        for(let elem=0;elem<this.scene.models.length;elem++) {
            let element = this.scene.models[elem];
            let steps;
            let x,y,et;
            switch(element.type)
            {
                case 'generic':
                    this.vertices = element.vertices;
                    this.edges = element.edges;
                    break;
                case 'cube':
                    let cx = element.center.x;
                    let cy = element.center.y;
                    let cz = element.center.z;

                    let w = (element.width)/2;
                    let h = (element.width)/2;
                    let d = (element.width)/2;

                    this.vertices = [Vector4(cx-w,cy-d,cz+h,1),Vector4(cx-w,cy+d,cz+h,1),Vector4(cx+w,cy+d,cz+h,1),Vector4(cx+w,cy-d,cz+h,1),Vector4(cx-w,cy-d,cz-h,1),Vector4(cx-w,cy+d,cz-h,1),Vector4(cx+w,cy+d,cz-h,1),Vector4(cx+w,cy-d,cz-h,1)];
                    this.edges = [[0,1,2,3,0],
                              [4,5,6,7,4],
                              [0,4],
                              [1,5],
                              [2,6],
                              [3,7]];
                    break;
                case 'cone':
                    this.vertices = [];
                    this.edges = [];
                    steps = element.sides;

                    for(let i = 0;i<steps;i++)
                    {
                        x = Math.round(element.center.x + element.radius * Math.cos(2 * Math.PI * i / steps));
                        y = Math.round(element.center.y + element.radius * Math.sin(2 * Math.PI * i / steps));
                        this.vertices.push(Vector4(x,y,element.center.z-(element.height/2),1));
                    }
                    //Connect all the edges of the circle
                    et = [];
                    for(let j=0;j<this.vertices.length;j++)
                    {
                        et.push(j);
                    }
                    //Complete circle
                    et.push(0);
                    this.edges.push(et);

                    this.vertices.push(Vector4(element.center.x,element.center.y,element.center.z+(element.height/2),1));

                    let numVerts = this.vertices.length;
                    et = [];
                    for(let k=0;k<numVerts-1;k++)
                    {
                        this.edges.push([k, numVerts-1]);
                    }
                    break;
                case 'cylinder':
                    this.vertices = [];
                    this.edges = [];
                    steps = element.sides;
                    for(let i = 0;i<steps;i++)
                    {
                        x = Math.round(element.center.x + element.radius * Math.cos(2 * Math.PI * i / steps));
                        y = Math.round(element.center.y + element.radius * Math.sin(2 * Math.PI * i / steps));
                        this.vertices.push(Vector4(x,y,element.center.z-(element.height/2),1));
                    }
                    //Connect all the edges of the circle
                    et = [];
                    for(let j=0;j<this.vertices.length;j++)
                    {
                        et.push(j);
                    }
                    //Complete circle
                    et.push(0);
                    this.edges.push(et);

                    for(let i = 0;i<steps;i++)
                    {
                        x = Math.round(element.center.x + element.radius * Math.cos(2 * Math.PI * i / steps));
                        y = Math.round(element.center.y + element.radius * Math.sin(2 * Math.PI * i / steps));
                        this.vertices.push(Vector4(x,y,element.center.z+(element.height/2),1));
                    }
                    //Connect all the edges of the circle
                    et = [];
                    for(let j=steps;j<this.vertices.length;j++)
                    {
                        et.push(j);
                    }
                    //Complete circle
                    et.push(steps);
                    this.edges.push(et);

                    for(let k=0;k<steps;k++)
                    {
                        this.edges.push([k, k+steps]);
                    }
                    break;
                case 'sphere':
                    //Build the xy with z offset
                    //Build the yz with x offset
                    //(Math.abs(offset from origin)-radius)*element.radius
                    this.vertices = [];
                    this.edges = [];
                    steps = 10;
                    let circleVerts = [];
                    for(let i = 0;i<steps;i++)
                    {
                        x = Math.round(element.center.x + element.radius * Math.cos(2 * Math.PI * i / steps));
                        y = Math.round(element.center.y + element.radius * Math.sin(2 * Math.PI * i / steps));
                        circleVerts.push(Vector4(x,y,element.center.z,1));
                        console.log(x,y);
                    }
                    let cent = this.get_center(circleVerts);
                    console.log(cent);
                    //We have a circle called circleVerts
                    steps = element.slices;
                    let rotFactor = 180/steps;

                    //Roataional Matrix and translations
                    let rotMatrix = new Matrix(4,4);
                    mat4x4RotateX(rotMatrix,rotFactor);
                    let tro = new Matrix(4,4);
                    mat4x4Translate(tro, -cent[0],-cent[1],-cent[2]);
                    let trb = new Matrix(4,4);
                    mat4x4Translate(trb, cent[0],cent[1],cent[2]);
                    //rotMatrix = Matrix.multiply([trb,rotMatrix,tro]);
                    
                    //Rotate all the points and make new circles
                    for(let i=0; i<=steps; i++)
                    {
                        //Rotate each point
                        for(let j=0;j<circleVerts.length;j++)
                        {
                            circleVerts[j] = Matrix.multiply([tro, circleVerts[j]]);
                            circleVerts[j] = Matrix.multiply([rotMatrix, circleVerts[j]]);
                            circleVerts[j] = Matrix.multiply([trb, circleVerts[j]]);
                        }
                        //We need to record the current circle circleVerts in this.vertices and this.edges
                        let size = this.vertices.length;
                        circleVerts.forEach(element => {
                            this.vertices.push(element);
                        });
                        et = [];
                        for(let k=0;k<steps;k++)
                        {
                            et.push(k+size);
                        }
                        this.edges.push(et);
                    }
                    ////////////////////////////////////////
                    steps = element.stacks;
                    circleVerts = [];
                    for(let i = 0;i<steps;i++)
                    {
                        x = Math.round(element.center.x + element.radius * Math.cos(2 * Math.PI * i / steps));
                        y = Math.round(element.center.y + element.radius * Math.sin(2 * Math.PI * i / steps));
                        circleVerts.push(Vector4(x,y,element.center.z,1));
                        console.log(x,y);
                    }
                    cent = this.get_center(circleVerts);
                    console.log(cent);
                    //We have a circle called circleVerts
                    steps = element.slices;
                    rotFactor = 180/steps;

                    //Roataional Matrix and translations
                    rotMatrix = new Matrix(4,4);
                    mat4x4RotateY(rotMatrix,rotFactor);
                    //rotMatrix = Matrix.multiply([trb,rotMatrix,tro]);
                    
                    //Rotate all the points and make new circles
                    for(let i=0; i<=steps; i++)
                    {
                        //Rotate each point
                        for(let j=0;j<circleVerts.length;j++)
                        {
                            circleVerts[j] = Matrix.multiply([tro, circleVerts[j]]);
                            circleVerts[j] = Matrix.multiply([rotMatrix, circleVerts[j]]);
                            circleVerts[j] = Matrix.multiply([trb, circleVerts[j]]);
                        }
                        //We need to record the current circle circleVerts in this.vertices and this.edges
                        let size = this.vertices.length;
                        circleVerts.forEach(element => {
                            this.vertices.push(element);
                        });
                        et = [];
                        for(let k=0;k<steps;k++)
                        {
                            et.push(k+size);
                        }
                        this.edges.push(et);
                    }
                    break;
            }
            this.center = this.get_center(this.vertices);
            //Update the center for rotation
            for(let i=0; i<this.edges.length; i++){
                for(let k = 0; k < this.edges[i].length-1; k++){
                    //take each point of the edge and rotate it
                    
                    let to = new Matrix(4,4);
                    let tb = new Matrix(4,4);
                    mat4x4Translate(to, -this.center[0], -this.center[1], -this.center[2]);
                    mat4x4Translate(tb, this.center[0], this.center[1], this.center[2]);

                    let v1 = Matrix.multiply([to,this.vertices[this.edges[i][k]]]);
                    v1 = Matrix.multiply([this.rotate, v1]);
                    v1 = Matrix.multiply([Nper, tb,v1]);

                    let v2 = Matrix.multiply([to,this.vertices[this.edges[i][(k+1)]]]);
                    v2 = Matrix.multiply([this.rotate, v2]);
                    v2 = Matrix.multiply([Nper,tb,v2]);

                    // clipping here
                    let line = {pt0: v1, pt1:v2};
                    let zMin = zmin1;
                    let clipped = this.clipLinePerspective(line, zMin);

                    if(clipped != null){
                        let Mper = mat4x4MPer();
                        
                        v1 = clipped.pt0;
                        v2 = clipped.pt1;

                        v1 = Matrix.multiply([viewport, Mper, v1]);

                        let vert1 = new Vector3((v1.x / v1.w), (v1.y/ v1.w));

                        v2 = Matrix.multiply([viewport, Mper, v2]);

                        let vert2 = new Vector3((v2.x / v2.w), (v2.y/ v2.w));

                        this.drawLine(vert1.x, vert1.y, vert2.x, vert2.y);
                    }
                }
            }
        }
        
    }

    // Get outcode for a vertex
    // vertex:       Vector4 (transformed vertex in homogeneous coordinates)
    // z_min:        float (near clipping plane in canonical view volume)
    outcodePerspective(vertex, z_min) {
        let outcode = 0;
        if (vertex.x < (vertex.z - FLOAT_EPSILON)) {
            outcode += LEFT;
        }
        else if (vertex.x > (-vertex.z + FLOAT_EPSILON)) {
            outcode += RIGHT;
        }
        if (vertex.y < (vertex.z - FLOAT_EPSILON)) {
            outcode += BOTTOM;
        }
        else if (vertex.y > (-vertex.z + FLOAT_EPSILON)) {
            outcode += TOP;
        }
        if (vertex.z < (-1.0 - FLOAT_EPSILON)) {
            outcode += FAR;
        }
        else if (vertex.z > (z_min + FLOAT_EPSILON)) {
            outcode += NEAR;
        }
        return outcode;
    }

    // Clip line - should either return a new line (with two endpoints inside view volume)
    //             or null (if line is completely outside view volume)
    // line:         object {pt0: Vector4, pt1: Vector4}
    // z_min:        float (near clipping plane in canonical view volume)
    clipLinePerspective(line, z_min) {
        let result = null;
        let p0 = Vector3(line.pt0.x, line.pt0.y, line.pt0.z);
        let p1 = Vector3(line.pt1.x, line.pt1.y, line.pt1.z);
        let out0 = this.outcodePerspective(p0, z_min);
        let out1 = this.outcodePerspective(p1, z_min);

        if ((out0 | out1) == 0) {
            // trivial accept, bitwise or the outcodes, if 0, then accept.
            result = line;
        } else if ((out0 & out1) != 0) {
            // trivial reject, bitwise and the ouctodes, if not 0, then reject.
            return null;
        } else {
            // need to, ya know, figure it out.
            // Starting with out0

            /*
            const LEFT =   32; // binary 100000
            const RIGHT =  16; // binary 010000
            const BOTTOM = 8;  // binary 001000
            const TOP =    4;  // binary 000100
            const FAR =    2;  // binary 000010
            const NEAR =   1;  // binary 000001
            */

            let p0C = p0;
            let p1C = p1;
            // convert out0 to a string binary, then loop until there isn't a 1 in the outcode
            while (out0.toString().indexOf('1') != -1) {
                let newOutcode = out0.toString();
                // pick a side, the first occurance of 1, and clip the line against that, then continue
                let side = newOutcode.indexOf('1');
                let dx = p1C.x - p0C.x;
                let dy = p1C.y - p0C.y;
                let dz = p1C.z - p0C.z;
                if (side == 0) {
                    // LEFT case
                    // know the x and the z, find the y
                    // x = p0C.x + T * dx
                    // y = p0C.y + T * dy
                    // z = p0C.z + T * dz

                    // leftT = (-p0C.x + p0C.z)/(dx - dz)

                    // TODO: question about bounding planes. It is perspective, am I doing the order correctly?
                    p0C.x = p0C.z;

                    let leftT = (-p0C.x + p0C.z) / (dx - dz);
                    p0C.y = p0C.y + (leftT * dy);

                } else if (side == 1) {
                    // RIGHT case
                    // know the x and the z, find the y
                    // x = p0C.x + T * dx
                    // y = p0C.y + T * dy
                    // z = p0C.z + T * dz

                    // rightT = (p0C.x + p0C.z)/(-dx - dz)
                    p0C.x = -p0C.z;

                    let rightT = (p0C.x + p0C.z) / (-dx - dz);
                    p0C.y = p0C.y + (rightT * dy);

                } else if (side == 2) {
                    // BOTTOM case
                    // know the y and the z, find the x
                    // x = p0C.x + T * dx
                    // y = p0C.y + T * dy
                    // z = p0C.z + T * dz

                    // bottomT = (-p0C.y + p0C.z)/(dy - dz)
                    p0C.y = p0C.z;

                    let bottomT = (-p0C.y + p0C.z) / (dy - dz);
                    p0C.x = p0C.x + (bottomT * dx);


                } else if (side == 3) {
                    // TOP case
                    // know the y and the z, find the x
                    // x = p0C.x + T * dx
                    // y = p0C.y + T * dy
                    // z = p0C.z + T * dz

                    // topT = (p0C.y + p0C.z)/(-dy - dz)
                    p0C.y = -p0C.z;

                    let topT = (p0C.y + p0C.z) / (-dy - dz);
                    p0C.x = p0C.x + (topT * dx);

                } else if (side == 4) {
                    // FAR case
                    // know the y and the x, find the z
                    // x = p0C.x + T * dx
                    // y = p0C.y + T * dy
                    // z = p0C.z + T * dz

                    // farT = (-p0C.z - 1)/(dz)
                    p0C.z = -1;

                    let farT = (-p0C.z - 1) / (dz);
                    p0C.z = p0C.z + (farT * dz);

                } else if (side == 5) {
                    // NEAR case
                    // know the y and the x, find the z
                    // x = p0C.x + T * dx
                    // y = p0C.y + T * dy
                    // z = p0C.z + T * dz

                    // nearT = (p0C.z - z_min)/(-dz)
                    p0C.z = z_min;

                    let nearT = (p0C.z - z_min) / (-dz);
                    p0C.z = p0C.z + (nearT * dz);

                }
                out0 = out0.toString().replace("1", "0");
            }

            while (out1.toString().indexOf('1') != -1) {
                let newOutcode = out1.toString();
                // pick a side, the first occurrence of 1, and clip the line against that, then continue
                let side = newOutcode.indexOf('1');
                let dx = p1C.x - p1C.x;
                let dy = p1C.y - p1C.y;
                let dz = p1C.z - p1C.z;
                if (side == 0) {
                    // LEFT case
                    // know the x and the z, find the y
                    // x = p1C.x + T * dx
                    // y = p1C.y + T * dy
                    // z = p1C.z + T * dz

                    // leftT = (-p1C.x + p1C.z)/(dx - dz)

                    // TODO: question about bounding planes. It is perspective, am I doing the order correctly?
                    p1C.x = p1C.z;

                    let leftT = (-p1C.x + p1C.z) / (dx - dz);
                    p1C.y = p1C.y + (leftT * dy);

                } else if (side == 1) {
                    // RIGHT case
                    // know the x and the z, find the y
                    // x = p1C.x + T * dx
                    // y = p1C.y + T * dy
                    // z = p1C.z + T * dz

                    // rightT = (p1C.x + p1C.z)/(-dx - dz)
                    p1C.x = -p1C.z;

                    let rightT = (p1C.x + p1C.z) / (-dx - dz);
                    p1C.y = p1C.y + (rightT * dy);

                } else if (side == 2) {
                    // BOTTOM case
                    // know the y and the z, find the x
                    // x = p1C.x + T * dx
                    // y = p1C.y + T * dy
                    // z = p1C.z + T * dz

                    // bottomT = (-p1C.y + p1C.z)/(dy - dz)
                    p1C.y = p1C.z;

                    let bottomT = (-p1C.y + p1C.z) / (dy - dz);
                    p1C.x = p1C.x + (bottomT * dx);


                } else if (side == 3) {
                    // TOP case
                    // know the y and the z, find the x
                    // x = p1C.x + T * dx
                    // y = p1C.y + T * dy
                    // z = p1C.z + T * dz

                    // topT = (p1C.y + p1C.z)/(-dy - dz)
                    p1C.y = -p1C.z;

                    let topT = (p1C.y + p1C.z) / (-dy - dz);
                    p1C.x = p1C.x + (topT * dx);

                } else if (side == 4) {
                    // FAR case
                    // know the y and the x, find the z
                    // x = p1C.x + T * dx
                    // y = p1C.y + T * dy
                    // z = p1C.z + T * dz

                    // farT = (-p1C.z - 1)/(dz)
                    p1C.z = -1;

                    let farT = (-p1C.z - 1) / (dz);
                    p1C.z = p1C.z + (farT * dz);

                } else if (side == 5) {
                    // NEAR case
                    // know the y and the x, find the z
                    // x = p1C.x + T * dx
                    // y = p1C.y + T * dy
                    // z = p1C.z + T * dz

                    // nearT = (p1C.z - z_min)/(-dz)
                    p1C.z = z_min;

                    let nearT = (p1C.z - z_min) / (-dz);
                    p1C.z = p1C.z + (nearT * dz);

                }
                out1 = out1.toString().replace("1", "0");
            }
            // All outcodes have been correctly handled.
            line.p0 = p0C;
            line.p1 = p1C;
            result = line;
        }
        return result;
    }


    //
    animate(timestamp) {
        // Get time and delta time for animation
        if (this.start_time === null) {
            this.start_time = timestamp;
            this.prev_time = timestamp;
        }
        let time = timestamp - this.start_time;
        let delta_time = timestamp - this.prev_time;

        // Update transforms for animation
        this.updateTransforms(time, delta_time);

        // Draw slide
        this.draw();

        // Invoke call for next frame in animation
        if (this.enable_animation) {
            window.requestAnimationFrame((ts) => {
                this.animate(ts);
            });
        }

        // Update previous time to current one for next calculation of delta time
        this.prev_time = timestamp;
    }

    //
    updateScene(scene) {
        this.scene = this.processScene(scene);
        if (!this.enable_animation) {
            this.draw();
        }
    }

    //
    processScene(scene) {
        let processed = {
            view: {
                prp: Vector3(scene.view.prp[0], scene.view.prp[1], scene.view.prp[2]),
                srp: Vector3(scene.view.srp[0], scene.view.srp[1], scene.view.srp[2]),
                vup: Vector3(scene.view.vup[0], scene.view.vup[1], scene.view.vup[2]),
                clip: [...scene.view.clip]
            },
            models: []
        };

        for (let i = 0; i < scene.models.length; i++) {
            let model = { type: scene.models[i].type };
            if (model.type === 'generic') {
                model.vertices = [];
                model.edges = JSON.parse(JSON.stringify(scene.models[i].edges));
                for (let j = 0; j < scene.models[i].vertices.length; j++) {
                    model.vertices.push(Vector4(scene.models[i].vertices[j][0],
                        scene.models[i].vertices[j][1],
                        scene.models[i].vertices[j][2],
                        1));
                    if (scene.models[i].hasOwnProperty('animation')) {
                        model.animation = JSON.parse(JSON.stringify(scene.models[i].animation));
                    }
                }
            }
            else {
                model.center = Vector4(scene.models[i].center[0],
                    scene.models[i].center[1],
                    scene.models[i].center[2],
                    1);
                for (let key in scene.models[i]) {
                    if (scene.models[i].hasOwnProperty(key) && key !== 'type' && key != 'center') {
                        model[key] = JSON.parse(JSON.stringify(scene.models[i][key]));
                    }
                }
            }

            model.matrix = new Matrix(4, 4);
            processed.models.push(model);
        }

        return processed;
    }

    // x0:           float (x coordinate of p0)
    // y0:           float (y coordinate of p0)
    // x1:           float (x coordinate of p1)
    // y1:           float (y coordinate of p1)
    drawLine(x0, y0, x1, y1) {
        this.ctx.strokeStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.moveTo(x0, y0);
        this.ctx.lineTo(x1, y1);
        this.ctx.stroke();

        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(x0 - 2, y0 - 2, 4, 4);
        this.ctx.fillRect(x1 - 2, y1 - 2, 4, 4);
    }
};
