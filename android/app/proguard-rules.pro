# Keep kotlinx.serialization metadata
-keepattributes *Annotation*, InnerClasses
-keepclassmembers class **$$serializer { *; }
-keep,includedescriptorclasses class com.claudeos.api.** { *; }
-keepclassmembers class com.claudeos.api.** { *; }
