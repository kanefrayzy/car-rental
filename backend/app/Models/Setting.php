<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One value from the admin panel's Settings page. Read them through App\Support\SiteSettings. */
class Setting extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['key', 'value'];
}
