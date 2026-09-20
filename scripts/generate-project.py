#!/usr/bin/env python3
"""Deterministic standalone Xcode project generator. No package-manager dependencies."""
from pathlib import Path
import hashlib
root = Path(__file__).resolve().parent.parent
project = root / 'MochaTabletop.xcodeproj'
project.mkdir(exist_ok=True)
objects = []
def uid(name): return hashlib.sha256(name.encode()).hexdigest()[:24].upper()
def obj(name, body):
    objects.append(f'\t\t{uid(name)} /* {name} */ = {{ {body} }};')
    return uid(name)
def arr(names): return '(' + ', '.join(uid(n) for n in names) + ',)'
files = [('App', 'iOS/MochaTabletopApp.swift', 'sourcecode.swift'), ('Assets', 'iOS/Assets.xcassets', 'folder.assetcatalog'), ('Privacy', 'iOS/PrivacyInfo.xcprivacy', 'text.xml'), ('Info', 'iOS/Info.plist', 'text.plist.xml')]
for name,path,kind in files:
    obj(name, f'isa = PBXFileReference; lastKnownFileType = {kind}; path = "{path}"; sourceTree = "<group>";')
for name in ['App', 'Assets', 'Privacy']:
    obj(name+'Build', f'isa = PBXBuildFile; fileRef = {uid(name)};')
obj('UIBuild', f'isa = PBXBuildFile; productRef = {uid("UIProduct")};')
obj('Application', 'isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = MochaTabletop.app; sourceTree = BUILT_PRODUCTS_DIR;')
obj('Products', f'isa = PBXGroup; children = {arr(["Application"])}; name = Products; sourceTree = "<group>";')
obj('MainGroup', f'isa = PBXGroup; children = {arr(["App","Assets","Privacy","Info","Products"])}; sourceTree = "<group>";')
for name,isa,children in [('Sources','PBXSourcesBuildPhase',['AppBuild']),('Resources','PBXResourcesBuildPhase',['AssetsBuild','PrivacyBuild']),('Frameworks','PBXFrameworksBuildPhase',['UIBuild'])]:
    obj(name, f'isa = {isa}; buildActionMask = 2147483647; files = {arr(children)}; runOnlyForDeploymentPostprocessing = 0;')
obj('LocalPackage', 'isa = XCLocalSwiftPackageReference; relativePath = .;')
obj('UIProduct', f'isa = XCSwiftPackageProductDependency; package = {uid("LocalPackage")}; productName = MochaUI;')
obj('Target', f'isa = PBXNativeTarget; buildConfigurationList = {uid("TargetConfigurations")}; buildPhases = {arr(["Sources","Frameworks","Resources"])}; buildRules = (); dependencies = (); name = MochaTabletop; packageProductDependencies = {arr(["UIProduct"])}; productName = MochaTabletop; productReference = {uid("Application")}; productType = "com.apple.product-type.application";')
base = 'ALWAYS_SEARCH_USER_PATHS = NO; CLANG_ENABLE_MODULES = YES; CLANG_ENABLE_OBJC_ARC = YES; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SDKROOT = iphoneos; SWIFT_VERSION = 5.0;'
target = 'ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; DEVELOPMENT_TEAM = ""; ENABLE_PREVIEWS = YES; GENERATE_INFOPLIST_FILE = NO; INFOPLIST_FILE = iOS/Info.plist; LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks"; MARKETING_VERSION = 0.1.0; PRODUCT_BUNDLE_IDENTIFIER = com.hengwei.mochatabletop; PRODUCT_NAME = "$(TARGET_NAME)"; SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"; SUPPORTS_MACCATALYST = NO; TARGETED_DEVICE_FAMILY = 1;'
for mode in ['Debug','Release']:
    settings = base + (' DEBUG_INFORMATION_FORMAT = dwarf; ENABLE_TESTABILITY = YES; GCC_OPTIMIZATION_LEVEL = 0; SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; ONLY_ACTIVE_ARCH = YES;' if mode == 'Debug' else ' DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym"; SWIFT_COMPILATION_MODE = wholemodule; SWIFT_OPTIMIZATION_LEVEL = "-O"; VALIDATE_PRODUCT = YES;')
    obj('Project'+mode, f'isa = XCBuildConfiguration; buildSettings = {{ {settings} }}; name = {mode};')
    obj('Target'+mode, f'isa = XCBuildConfiguration; buildSettings = {{ {target} }}; name = {mode};')
for level in ['Project','Target']:
    obj(level+'Configurations', f'isa = XCConfigurationList; buildConfigurations = {arr([level+"Debug",level+"Release"])}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
obj('Project', f'isa = PBXProject; attributes = {{ BuildIndependentTargetsInParallel = YES; LastSwiftUpdateCheck = 1600; LastUpgradeCheck = 1600; TargetAttributes = {{ {uid("Target")} = {{ CreatedOnToolsVersion = 16.0; }}; }}; }}; buildConfigurationList = {uid("ProjectConfigurations")}; compatibilityVersion = "Xcode 14.0"; developmentRegion = zh-Hans; hasScannedForEncodings = 0; knownRegions = ("zh-Hans", en, Base); mainGroup = {uid("MainGroup")}; packageReferences = {arr(["LocalPackage"])}; productRefGroup = {uid("Products")}; projectDirPath = ""; projectRoot = ""; targets = {arr(["Target"])};')
(project / 'project.pbxproj').write_text('// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {};\n\tobjectVersion = 56;\n\tobjects = {\n'+'\n'.join(objects)+'\n\t};\n\trootObject = '+uid('Project')+';\n}\n')
schemes = project / 'xcshareddata/xcschemes'; schemes.mkdir(parents=True, exist_ok=True)
ref = f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{uid("Target")}" BuildableName="MochaTabletop.app" BlueprintName="MochaTabletop" ReferencedContainer="container:MochaTabletop.xcodeproj"/>'
(schemes / 'MochaTabletop.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{ref}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables/></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/>
<ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
''')
print(project)
