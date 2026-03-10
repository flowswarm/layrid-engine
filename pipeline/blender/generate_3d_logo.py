import bpy
import sys
import argparse
import math

def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def generate_text_logo(text_string):
    bpy.ops.object.text_add(location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.data.body = text_string
    # Optionally load a specific font here: obj.data.font = bpy.data.fonts.load('/path/to/font.ttf')
    return obj

def generate_svg_logo(svg_path):
    bpy.ops.import_curve.svg(filepath=svg_path)
    # SVGs import as a collection of curves. Join them.
    curves = [obj for obj in bpy.context.scene.objects if obj.type == 'CURVE']
    if not curves:
        raise ValueError(f"SVG '{svg_path}' contains no importable curve paths. "
                         "Ensure the SVG has vector paths, not only raster images or text.")
    for curve in curves:
        curve.select_set(True)
    bpy.context.view_layer.objects.active = curves[0]
    
    if len(curves) > 1:
        bpy.ops.object.join()
    
    return bpy.context.active_object

def generate_png_logo(png_path):
    # This is complex in headless. Usually requires 'Trace Image to Grease Pencil', 
    # then 'Grease Pencil to Curve'. 
    # For a robust pipeline, it's better to force clients to provide SVGs or use a Node.js pre-processor (like potrace) 
    # to convert PNG -> SVG before handing to Blender.
    print("WARNING: PNG tracing is less reliable than SVG. Recommend pre-processing to SVG.")
    pass

def apply_geometry(obj, extrusion_depth, bevel_depth, bevel_resolution):
    obj.data.extrude = extrusion_depth
    obj.data.bevel_depth = bevel_depth
    obj.data.bevel_resolution = bevel_resolution

def normalize_mesh(obj):
    # Convert curve/text to actual polygons for clean WebGL rendering
    bpy.ops.object.convert(target='MESH')
    
    # Critical: Set origin to the exact mathematical center of the geometry
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    obj.location = (0, 0, 0)
    
    # Scale normalization: Force largest dimension to exactly 2.0 units
    # This ensures a 4-letter logo and 12-letter logo fit the camera view similarly
    dims = obj.dimensions
    max_dim = max(dims.x, dims.y, dims.z)
    if max_dim > 0:
        scale_factor = 2.0 / max_dim
        obj.scale = (scale_factor, scale_factor, scale_factor)
        
    # Apply transforms so rotation/scale are baked into vertices (0,0,0 / 1,1,1)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    
    # Standardize the name for the Scene Manager to find
    obj.name = "HeroMesh"

def assign_material(obj, preset, hex_color):
    mat = bpy.data.materials.new(name="CenterpieceMat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    
    if preset == 'chrome':
        bsdf.inputs['Metallic'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.05
    elif preset == 'matte-plastic':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.8
    elif preset == 'glass':
        # Support both Blender 3.x ('Transmission') and 4.x ('Transmission Weight')
        transmission_key = 'Transmission Weight' if 'Transmission Weight' in bsdf.inputs else 'Transmission'
        bsdf.inputs[transmission_key].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.0
        bsdf.inputs['IOR'].default_value = 1.45
    elif preset == 'brushed-metal':
        bsdf.inputs['Metallic'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.4
        bsdf.inputs['Anisotropic'].default_value = 0.8
    elif preset == 'emissive-neon':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.0
        bsdf.inputs['Emission Strength'].default_value = 3.0
        # Emission color follows brand color — set below with base color
    elif preset == 'flat-monochrome':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 1.0
        bsdf.inputs['Base Color'].default_value = (0.15, 0.15, 0.15, 1.0)
    if hex_color:
        hex_color = hex_color.lstrip('#')
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
        # Convert sRGB to linear (Blender's color space)
        def srgb_to_linear(c):
            return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        bsdf.inputs['Base Color'].default_value = (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)
        if preset == 'emissive-neon':
            bsdf.inputs['Emission Color'].default_value = (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)

    obj.data.materials.append(mat)

def add_anchor_socket(obj):
    """
    Creates a 'TextAnchorSocket' Empty at a predictable position relative to the mesh.
    The WebGL anchor projection system uses this to project 3D → 2D coordinates.
    
    Position: slightly above and in front of the mesh center, so projected 
    text appears above the logo on screen.
    """
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0.8, 0.3))
    anchor = bpy.context.active_object
    anchor.name = 'TextAnchorSocket'
    anchor.empty_display_size = 0.1
    
    # Parent to the mesh so it transforms with it
    anchor.parent = obj
    
    print(f"[Anchor] TextAnchorSocket created at {anchor.location}")

def export_glb(output_path):
    # Select only what we want: HeroMesh + TextAnchorSocket
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.name in ('HeroMesh', 'TextAnchorSocket'):
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_materials='EXPORT',
        export_yup=True
    )
    print(f"Bake Complete: {output_path}")


def main():
    """Full pipeline entry point. Parses CLI args passed after '--' separator."""
    # Parse arguments passed after blender's '--' separator
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        argv = []
    
    parser = argparse.ArgumentParser(description='Layrid 3D Logo Generator')
    parser.add_argument('--type', choices=['svg', 'text', 'png'], required=True)
    parser.add_argument('--source', required=True, help='File path or text string')
    parser.add_argument('--extrude', type=float, default=0.1)
    parser.add_argument('--bevel', type=float, default=0.02)
    parser.add_argument('--bevel-res', type=int, default=4)
    parser.add_argument('--material', default='chrome')
    parser.add_argument('--color', default='')
    parser.add_argument('--output', required=True, help='GLB output path')
    
    args = parser.parse_args(argv)
    
    # 1. Clean scene
    clean_scene()
    
    # 2. Generate geometry based on input type
    if args.type == 'svg':
        obj = generate_svg_logo(args.source)
    elif args.type == 'text':
        obj = generate_text_logo(args.source)
    elif args.type == 'png':
        obj = generate_png_logo(args.source)
        if obj is None:
            print("ERROR: PNG generation not fully supported")
            sys.exit(1)
    
    # 3. Apply geometry modifiers
    apply_geometry(obj, args.extrude, args.bevel, args.bevel_res)
    
    # 4. Normalize mesh (center, scale, rename to HeroMesh)
    normalize_mesh(obj)
    
    # 5. Assign material preset
    assign_material(obj, args.material, args.color if args.color else None)
    
    # 6. Add anchor socket for WebGL projection system
    add_anchor_socket(obj)
    
    # 7. Export GLB
    export_glb(args.output)
    
    print(f"[Pipeline] ✅ Logo generation complete: {args.output}")


if __name__ == '__main__':
    main()
