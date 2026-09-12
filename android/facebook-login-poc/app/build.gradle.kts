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
        versionCode = 2
        versionName = "0.2.0"
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

    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-functions")

    implementation("com.facebook.android:facebook-login:18.0.3")
}
