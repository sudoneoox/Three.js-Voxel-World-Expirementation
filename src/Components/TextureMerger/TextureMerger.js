let TextureMergerRectangle = function( x, y, width, height )
{
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.finalX = x + width;
    this.finalY = y + height;
}

TextureMergerRectangle.prototype.set = function( x, y, x2, y2, width, height )
{
    this.x = x;
    this.y = y;
    this.finalX = x2;
    this.finalY = y2;
    this.width = width,
        this.height = height;
    return this;
}

TextureMergerRectangle.prototype.fits = function( texture )
{
    let tw = texture.image.width;
    let th = texture.image.height;
    if ( tw <= this.width && th <= this.height )
    {
        return true;
    }
    return false;
}

TextureMergerRectangle.prototype.fitsPerfectly = function( texture )
{
    let tw = texture.image.width;
    let th = texture.image.height;
    return ( tw == this.width ) && ( th == this.height );
}

TextureMergerRectangle.prototype.overlaps = function( rect )
{
    return this.x < rect.x + rect.width && this.x + this.width > rect.x && this.y < rect.y + rect.height && this.y + this.height > rect.y;
}

let TextureMerger = function( texturesObj )
{

    this.MAX_TEXTURE_SIZE = 4096;

    if ( !texturesObj )
    {
        return;
    }
    this.dataURLs = new Object( );
    for ( let textureName in texturesObj )
    {
        let txt = texturesObj[ textureName ];

        if ( txt instanceof THREE.CompressedTexture )
        {
            throw new Error( "CompressedTextures are not supported." );
        }

        if ( typeof txt.image.toDataURL == "undefined" )
        {
            let tmpCanvas = document.createElement( "canvas" );
            tmpCanvas.width = txt.image.naturalWidth;
            tmpCanvas.height = txt.image.naturalHeight;
            tmpCanvas.getContext( '2d' ).drawImage( txt.image, 0, 0 );
            this.dataURLs[ textureName ] = tmpCanvas.toDataURL( );
        }
        else
        {
            this.dataURLs[ textureName ] = txt.image.toDataURL( );
        }
    }
    this.canvas = document.createElement( "canvas" );
    this.textureCount = 0;
    this.maxWidth = 0;
    this.maxHeight = 0;
    let explanationStr = "";
    for ( textureName in texturesObj )
    {
        this.textureCount++;
        let texture = texturesObj[ textureName ];
        texture.area = texture.image.width * texture.image.height;
        if ( texture.image.width > this.maxWidth )
        {
            this.maxWidth = texture.image.width;
        }
        if ( texture.image.height > this.maxHeight )
        {
            this.maxHeight = texture.image.height;
        }
        explanationStr += textureName + ",";
    }
    explanationStr = explanationStr.substring( 0, explanationStr.length - 1 );
    this.textureCache = new Object( );
    // node
    //  |___ children: Array(2) of node
    //  |___ rectangle: TextureMergerRectangle
    //  |___ textureName: String
    //  |___ upperNode: node
    this.node = new Object( );
    this.node.rectangle = new TextureMergerRectangle( 0, 0, this.maxWidth * this.textureCount,
        this.maxHeight * this.textureCount );
    this.textureOffsets = new Object( );
    this.allNodes = [ ];
    this.insert( this.node, this.findNextTexture( texturesObj ), texturesObj );

    this.ranges = new Object( );
    let imgSize = this.calculateImageSize( texturesObj );
    this.canvas.width = imgSize.width;
    this.canvas.height = imgSize.height;
    let context = this.canvas.getContext( "2d" );
    this.context = context;
    for ( textureName in this.textureOffsets )
    {
        let texture = texturesObj[ textureName ];
        let offsetX = this.textureOffsets[ textureName ].x;
        let offsetY = this.textureOffsets[ textureName ].y;
        let imgWidth = texture.image.width;
        let imgHeight = texture.image.height;

        for ( let y = offsetY; y < offsetY + imgHeight; y += imgHeight )
        {
            for ( let x = offsetX; x < offsetX + imgWidth; x += imgWidth )
            {
                context.drawImage( texture.image, x, y, imgWidth, imgHeight );
            }
        }

        let range = new Object( );
        range.startU = offsetX / imgSize.width;
        range.endU = ( offsetX + imgWidth ) / imgSize.width;
        range.startV = 1 - ( offsetY / imgSize.height );
        range.endV = 1 - ( ( offsetY + imgHeight ) / imgSize.height );
        this.ranges[ textureName ] = range;
    }

    this.makeCanvasPowerOfTwo( );
    this.mergedTexture = new THREE.CanvasTexture( this.canvas );
    this.mergedTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.mergedTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.mergedTexture.minFilter = THREE.NearestFilter;
    this.mergedTexture.magFilter = THREE.NearestFilter;
    this.mergedTexture.needsUpdate = true;
}

TextureMerger.prototype.isTextureAlreadyInserted = function( textureName, texturesObj )
{
    let texture = texturesObj[ textureName ];
    let img = this.dataURLs[ textureName ];
    for ( let tName in texturesObj )
    {
        if ( tName == textureName )
        {
            continue;
        }
        let txt = texturesObj[ tName ];
        let tImg = this.dataURLs[ tName ];
        if ( img == tImg && ( txt.offset.x == texture.offset.x ) && ( txt.offset.y == texture.offset.y ) &&
            ( txt.offset.z == texture.offset.z ) && ( txt.repeat.x == texture.repeat.x ) &&
            ( txt.repeat.y == texture.repeat.y ) && ( txt.flipX == texture.flipX ) && ( txt.flipY == texture.flipY ) &&
            ( txt.wrapS == texture.wrapS ) && ( txt.wrapT == texture.wrapT ) )
        {
            if ( this.textureOffsets[ tName ] )
            {
                return this.textureOffsets[ tName ];
            }
        }
    }
    return false;
}

TextureMerger.prototype.insert = function( node, textureName, texturesObj )
{
    let texture = texturesObj[ textureName ];
    let res = this.isTextureAlreadyInserted( textureName, texturesObj );
    if ( res )
    {
        this.textureOffsets[ textureName ] = res;
        let newTextureName = this.findNextTexture( texturesObj );
        if ( !( newTextureName == null ) )
        {
            this.insert( node, newTextureName, texturesObj );
        }
        return;
    }
    let tw = texture.image.width;
    let th = texture.image.height;
    if ( node.upperNode )
    {
        let minArea = ( ( this.maxWidth * this.textureCount ) + ( this.maxHeight * this.textureCount ) );
        let minAreaNode = 0;
        let inserted = false;
        for ( let i = 0; i < this.allNodes.length; i++ )
        {
            let curNode = this.allNodes[ i ];
            if ( !curNode.textureName && curNode.rectangle.fits( texture ) )
            {
                this.textureOffsets[ textureName ] = { x: curNode.rectangle.x, y: curNode.rectangle.y };
                let calculatedSize = this.calculateImageSize( texturesObj );
                let calculatedArea = calculatedSize.width + calculatedSize.height;
                if ( calculatedArea < minArea && calculatedSize.width <= this.MAX_TEXTURE_SIZE && calculatedSize.height <= this.MAX_TEXTURE_SIZE )
                {
                    let overlaps = false;
                    for ( let tName in this.textureOffsets )
                    {
                        if ( tName == textureName )
                        {
                            continue;
                        }
                        let cr = curNode.rectangle;
                        let ox = this.textureOffsets[ tName ].x;
                        let oy = this.textureOffsets[ tName ].y;
                        let oimg = texturesObj[ tName ].image;
                        let rect1 = new TextureMergerRectangle( cr.x, cr.y, tw, th );
                        let rect2 = new TextureMergerRectangle( ox, oy, oimg.width, oimg.height );
                        if ( rect1.overlaps( rect2 ) )
                        {
                            overlaps = true;
                        }
                    }
                    if ( !overlaps )
                    {
                        minArea = calculatedArea;
                        minAreaNode = this.allNodes[ i ];
                        inserted = true;
                    }
                }
                delete this.textureOffsets[ textureName ];
            }
        }
        if ( inserted )
        {
            this.textureOffsets[ textureName ] = { x: minAreaNode.rectangle.x, y: minAreaNode.rectangle.y };
            minAreaNode.textureName = textureName;
            if ( !minAreaNode.children )
            {
                let childNode1 = new Object( );
                let childNode2 = new Object( );
                childNode1.upperNode = minAreaNode;
                childNode2.upperNode = minAreaNode;
                minAreaNode.children = [ childNode1, childNode2 ];
                let rx = minAreaNode.rectangle.x;
                let ry = minAreaNode.rectangle.y;
                let maxW = this.maxWidth * this.textureCount;
                let maxH = this.maxHeight * this.textureCount;
                childNode1.rectangle = new TextureMergerRectangle( rx + tw, ry, maxW - ( rx + tw ), maxH - ry );
                childNode2.rectangle = new TextureMergerRectangle( rx, ry + th, maxW - rx, maxH - ( ry + th ) );
                this.allNodes.push( childNode1 );
                this.allNodes.push( childNode2 );
            }
            let newTextureName = this.findNextTexture( texturesObj );
            if ( !( newTextureName == null ) )
            {
                this.insert( node, newTextureName, texturesObj );
            }
        }
        else
        {
            throw new Error( "Error: Try to use smaller textures." );
        }
    }
    else
    {
        // First node
        let recW = node.rectangle.width;
        let recH = node.rectangle.height;
        node.textureName = textureName;
        let childNode1 = new Object( );
        let childNode2 = new Object( );
        childNode1.upperNode = node;
        childNode2.upperNode = node;
        node.children = [ childNode1, childNode2 ];
        childNode1.rectangle = new TextureMergerRectangle( tw, 0, recW - tw, th );
        childNode2.rectangle = new TextureMergerRectangle( 0, th, recW, recH - th );
        this.textureOffsets[ textureName ] = { x: node.rectangle.x, y: node.rectangle.y };
        let newNode = node.children[ 0 ];
        this.allNodes = [ node, childNode1, childNode2 ];
        let newTextureName = this.findNextTexture( texturesObj );
        if ( !( newTextureName == null ) )
        {
            this.insert( newNode, newTextureName, texturesObj );
        }
    }
}

TextureMerger.prototype.makeCanvasPowerOfTwo = function( canvas )
{
    let setCanvas = false;
    if ( !canvas )
    {
        canvas = this.canvas;
        setCanvas = true;
    }
    let oldWidth = canvas.width;
    let oldHeight = canvas.height;
    let newWidth = Math.pow( 2, Math.round( Math.log( oldWidth ) / Math.log( 2 ) ) );
    let newHeight = Math.pow( 2, Math.round( Math.log( oldHeight ) / Math.log( 2 ) ) );
    let newCanvas = document.createElement( "canvas" );
    newCanvas.width = newWidth;
    newCanvas.height = newHeight;
    newCanvas.getContext( "2d" ).drawImage( canvas, 0, 0, newWidth, newHeight );
    if ( setCanvas )
    {
        this.canvas = newCanvas;
    }
}

TextureMerger.prototype.calculateImageSize = function( texturesObj )
{
    let width = 0;
    let height = 0;
    for ( let textureName in this.textureOffsets )
    {
        let texture = texturesObj[ textureName ];
        let tw = texture.image.width;
        let th = texture.image.height;
        let x = this.textureOffsets[ textureName ].x;
        let y = this.textureOffsets[ textureName ].y;
        if ( x + tw > width )
        {
            width = x + tw;
        }
        if ( y + th > height )
        {
            height = y + th;
        }
    }
    return { "width": width, "height": height };
}

TextureMerger.prototype.findNextTexture = function( texturesObj )
{
    let maxArea = -1;
    let foundTexture;
    for ( textureName in texturesObj )
    {
        let texture = texturesObj[ textureName ];
        if ( !this.textureCache[ textureName ] )
        {
            if ( texture.area > maxArea )
            {
                maxArea = texture.area;
                foundTexture = textureName;
            }
        }
    }
    if ( maxArea == -1 )
    {
        return null;
    }
    this.textureCache[ foundTexture ] = true;
    return foundTexture;
}

TextureMerger.prototype.rescale = function( canvas, scale )
{
    let resizedCanvas = document.createElement( "canvas" );
    resizedCanvas.width = canvas.width * scale;
    resizedCanvas.height = canvas.height * scale;
    let resizedContext = resizedCanvas.getContext( "2d" );
    resizedContext.drawImage( canvas, 0, 0, canvas.width, canvas.height, 0, 0, resizedCanvas.width, resizedCanvas.height );
    //this.debugCanvas(resizedCanvas);
    return resizedCanvas;
};
export default TextureMerger;