@props(['url'])
{{-- Laravel's mail header with the site's white logo on a navy band (theme: themes/default.css).
     The image travels inside the email (cid:, attached by App\Listeners\EmbedMailLogo) so it shows
     even where remote images are blocked. Email clients do not show SVG. --}}
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block;">
<img src="cid:bueno-logo" width="180" height="44" alt="{{ config('app.name') }}" style="width: 180px; height: auto; max-width: 100%; border: 0; color: #ffffff; font-size: 20px; font-weight: bold;">
</a>
</td>
</tr>
