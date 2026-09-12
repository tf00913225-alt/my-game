plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val hasGoogleServicesJson = file("google-services.json").isFile
val metaFacebookClientToken = providers.environmentVariable("META_FACEBOOK_CLIENT_TOKEN")
    .orNull
    ?.trim()
    .orEmpty()

if (hasGoogleServicesJson) {
    // Firebase Console generates this file for this exact Android package. It is
    // intentionally ignored by Git and is never replaced by source literals.
    apply(plugin = "com.google.gms.google-services")
} else {
    logger.lifecycle("google-services.json is absent: this build is source-only and cannot sign in to Firebase.")
}

android {
    namespace = "com.foursymbols.jianghu.authpoc"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.foursymbols.jianghu.authpoc"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("boolean", "HAS_GOOGLE_SERVICES_JSON", hasGoogleServicesJson.toString())
        buildConfigField("boolean", "HAS_META_FACEBOOK_CLIENT_TOKEN", metaFacebookClientToken.isNotBlank().toString())
        resValue("string", "facebook_client_token", metaFacebookClientToken)
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")

    // The BoM pins mutually compatible Android Firebase library versions.
    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-auth")

    // Native Meta Android SDK. This is intentionally not a WebView/OAuth workaround.
    implementation("com.facebook.android:facebook-login:18.0.3")
}
