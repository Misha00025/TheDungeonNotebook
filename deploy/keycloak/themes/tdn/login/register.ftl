<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#import "register-commons.ftl" as registerCommons>
<#import "password-validation.ftl" as validator>
<#assign usernameValue = "">
<#if profile?? && profile.attributes??>
    <#assign usernameAttributes = profile.attributes?filter(attribute -> attribute.name == "username")>
    <#if usernameAttributes?size gt 0>
        <#assign usernameValue = usernameAttributes?first.value!"">
    </#if>
</#if>
<@layout.registrationLayout displayMessage=true displayRequiredFields=true; section>
    <#if section = "header">
        <#if messageHeader??>
            ${kcSanitize(msg("${messageHeader}"))?no_esc}
        <#else>
            ${msg("registerTitle")}
        </#if>
    <#elseif section = "form">
        <form id="kc-register-form" class="${properties.kcFormClass!}" action="${url.registrationAction}" method="post" novalidate>
            <#if realm.internationalizationEnabled && locale.currentLanguageTag??>
                <input type="hidden" name="locale" value="${locale.currentLanguageTag}" />
            </#if>
            <@field.input name="username" label=msg("username") value=usernameValue required=true autocomplete="username" autofocus=true />
            <#if passwordRequired?? && passwordRequired>
                <@field.password name="password" label=msg("password") required=true autocomplete="new-password" />
                <@field.password name="password-confirm" label=msg("passwordConfirm") required=true autocomplete="new-password" />
                <@validator.templates />
            </#if>
            <#list ["email", "firstName", "lastName"] as excludedField>
                <#if messagesPerField.existsError(excludedField)>
                    <div class="${properties.kcAlertClass!} pf-m-danger" role="alert">
                        <span class="${properties.kcAlertTitleClass!} kc-feedback-text">${messagesPerField.get(excludedField)}</span>
                    </div>
                </#if>
            </#list>
            <@registerCommons.termsAcceptance />
            <#if recaptchaRequired?? && (recaptchaVisible!false)>
                <div class="form-group">
                    <div class="${properties.kcInputWrapperClass!}">
                        <div class="g-recaptcha" data-size="compact" data-sitekey="${recaptchaSiteKey}" data-action="${recaptchaAction}"></div>
                    </div>
                </div>
            </#if>
            <div class="${properties.kcFormGroupClass!}">
                <div id="kc-form-options" class="${properties.kcFormOptionsClass!}">
                    <div class="${properties.kcFormOptionsWrapperClass!}">
                        <span><a href="${url.loginUrl}">${msg("backToLogin")}</a></span>
                    </div>
                </div>
                <#if recaptchaRequired?? && !(recaptchaVisible!false)>
                    <script>
                        function onSubmitRecaptcha(token) {
                            document.getElementById("kc-register-form").requestSubmit();
                        }
                    </script>
                    <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                        <button class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!} g-recaptcha"
                            data-sitekey="${recaptchaSiteKey}" data-callback="onSubmitRecaptcha" data-action="${recaptchaAction}" type="submit">
                            ${msg("doRegister")}
                        </button>
                    </div>
                <#else>
                    <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                        <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("doRegister")}" />
                    </div>
                </#if>
            </div>
        </form>
        <#if passwordRequired?? && passwordRequired>
            <@validator.script field="password" />
        </#if>
    </#if>
</@layout.registrationLayout>
